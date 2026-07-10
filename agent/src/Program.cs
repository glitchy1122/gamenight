// Entry point (SDD §12): single instance, link if needed, tray + detectors.
using System.Diagnostics;
using System.Net.NetworkInformation;
using Microsoft.Win32;

namespace GameNight.Agent;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        // Self-update child process: must run BEFORE the single-instance mutex,
        // otherwise the still-running parent blocks us and we never swap.
        if (args.Length >= 4 && args[0] == Updater.ApplyUpdateFlag)
        {
            if (!int.TryParse(args[3], out int parentPid)) Environment.Exit(1);
            Environment.Exit(Updater.ApplyUpdate(args[1], args[2], parentPid));
            return;
        }

        // Single instance via named mutex: a second launch just exits.
        using var mutex = new Mutex(true, @"Local\GameNightAgent", out bool isNew);
        if (!isNew) return;

        ApplicationConfiguration.Initialize();

        var config = AgentConfig.Load();
        string? token = config.GetToken();

        if (token is null)
        {
            using var form = new LinkForm(config.ServerUrl);
            if (form.ShowDialog() != DialogResult.OK || form.Token is null) return; // user cancelled
            config.ServerUrl = form.ServerUrl;
            config.SetToken(form.Token);
            config.Save();
            token = form.Token;
        }

        RegisterAutostart();

        using var link = new ServerLink(config.ServerUrl, token);
        using var probes = new ProbeEngine();
        using var tray = new TrayIcon(config.ServerUrl, link);

        // Phase 3: server sends who to probe → feed the probe engine.
        // Also keep the latest list for diagnostics (peer reachability).
        List<Peer> currentPeers = new();
        link.PeersReceived += peers => { currentPeers = peers; probes.SetPeers(peers); };
        // Phase 4: server sends toast notifications → show a Windows balloon.
        // Marshal to the UI thread; NotifyIcon must be touched from there.
        link.ToastReceived += (title, body) => tray.ShowToast(title, body);
        // Phase 5: server asks the agent to self-check → run diagnostics, report.
        link.DiagnoseRequested += () => _ = Task.Run(async () =>
        {
            var checks = await Diagnostics.RunAsync(currentPeers, config.ServerUrl);
            var dto = checks.ConvertAll(c => new DiagCheckDto(
                c.Id, c.Label, c.Status.ToString().ToLowerInvariant(), c.Detail, c.Fix));
            link.ReportDiagnostics(dto);
        });
        // Phase 5: self-update — tray "Check for updates" or background poll.
        tray.UpdateCheckRequested += () => _ = RunUpdateCheckAsync(config.ServerUrl, tray, manual: true);
        link.Start();
        probes.Start();

        // Detector loop: poll game/adapters every 5s. Timers, never busy loops.
        bool paused = false;
        tray.PauseToggled += p => { paused = p; if (p) link.ReportState("idle", RadminDetector.Detect()); };

        RadminInfo radmin = RadminDetector.Detect();
        var timer = new System.Windows.Forms.Timer { Interval = 5000 };
        timer.Tick += (_, _) =>
        {
            if (paused) return;
            radmin = RadminDetector.Detect(); // every 5s — catches Radmin connecting after launch
            string state = GameDetector.IsFarCry2Running() ? "in_game" : "online";
            link.ReportState(state, radmin);
        };

        // Metrics timer: every 30s, summarize the probe windows and report.
        // (Probes themselves run every 10s inside ProbeEngine.)
        var metricsTimer = new System.Windows.Forms.Timer { Interval = 30_000 };
        metricsTimer.Tick += (_, _) => { if (!paused) link.ReportMetrics(probes.Summarize()); };

        // Self-update: first check ~60s after launch (let the link settle), then
        // every 6 hours. Fail-quiet — never interrupt a match with a dialog.
        var updateTimer = new System.Windows.Forms.Timer { Interval = 60_000 };
        void ScheduleNextUpdateCheck(int ms)
        {
            updateTimer.Stop();
            updateTimer.Interval = ms;
            updateTimer.Start();
        }
        updateTimer.Tick += (_, _) =>
        {
            ScheduleNextUpdateCheck(6 * 60 * 60 * 1000); // 6h
            _ = RunUpdateCheckAsync(config.ServerUrl, tray, manual: false);
        };
        updateTimer.Start();

        NetworkChange.NetworkAddressChanged += (_, _) => { radmin = RadminDetector.Detect(); };
        timer.Start();
        metricsTimer.Start();
        link.ReportState("online", radmin);

        Application.Run(); // message loop until tray → Quit
    }

    private static async Task RunUpdateCheckAsync(string serverUrl, TrayIcon tray, bool manual)
    {
        UpdateResult result = await Updater.CheckAndApplyAsync(serverUrl, silentIfCurrent: !manual);
        switch (result.Outcome)
        {
            case UpdateOutcome.Updated:
                tray.ShowToast("GameNight update", result.Message);
                // Give the balloon a moment, then exit so the swap child can replace us.
                await Task.Delay(1500);
                Application.Exit();
                break;
            case UpdateOutcome.UpToDate:
                if (manual) tray.ShowToast("GameNight update", result.Message);
                break;
            case UpdateOutcome.NotConfigured:
                if (manual) tray.ShowToast("GameNight update", result.Message);
                break;
            case UpdateOutcome.Failed:
                tray.ShowToast("GameNight update", result.Message);
                break;
            default:
            {
                UpdateOutcome unreachable = result.Outcome;
                throw new InvalidOperationException($"Unhandled update outcome: {unreachable}");
            }
        }
    }

    private static void RegisterAutostart()
    {
        // HKCU Run key: per-user autostart, no admin, removable in Task Manager
        // → Startup apps. A Windows *Service* was rejected in SDD §12.
        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run", writable: true);
            key?.SetValue("GameNightAgent", $"\"{Environment.ProcessPath}\"");
        }
        catch (Exception ex) { Debug.WriteLine($"[autostart] {ex.Message}"); }
    }
}
