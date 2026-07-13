// Self-diagnostics (SDD §21, FR-50..53). The agent is the only component that
// can see the local machine, so "Check my setup" runs HERE and reports results
// to the dashboard. Each check returns a status + a plain-language fix so a
// non-technical friend can self-serve instead of messaging the admin at 11pm.
// Every check is READ-ONLY and privacy-preserving.
using System.Net.NetworkInformation;

namespace GameNight.Agent;

public enum CheckStatus { Pass, Warn, Fail }

public record CheckResult(string Id, string Label, CheckStatus Status, string Detail, string? Fix);

public static class Diagnostics
{
    public static async Task<List<CheckResult>> RunAsync(IEnumerable<Peer> peers, string? serverUrl = null)
    {
        var results = new List<CheckResult>();

        RadminInfo radmin = RadminDetector.Detect();
        if (radmin.Connected)
            results.Add(new("radmin", "Radmin VPN connected", CheckStatus.Pass, $"Connected as {radmin.Ip}", null));
        else if (RadminAdapterExists())
            results.Add(new("radmin", "Radmin VPN connected", CheckStatus.Fail,
                "Radmin is installed but not connected.",
                "Open Radmin VPN and click Connect, then join the GameNight network."));
        else
            results.Add(new("radmin", "Radmin VPN connected", CheckStatus.Fail,
                "Radmin VPN doesn't appear to be installed.",
                "Install Radmin VPN, then join the GameNight network (link on the Setup page)."));

        var peerList = peers.ToList();
        if (!radmin.Connected)
            results.Add(new("peers", "Other players reachable", CheckStatus.Warn, "Skipped — connect Radmin first.", null));
        else if (peerList.Count == 0)
            results.Add(new("peers", "Other players reachable", CheckStatus.Warn,
                "No other players online right now to test against.",
                "Not an error — try again when a friend is online."));
        else
        {
            int reachable = 0;
            foreach (var p in peerList)
            {
                try { using var ping = new Ping(); var r = await ping.SendPingAsync(p.RadminIp, 2000); if (r.Status == IPStatus.Success) reachable++; }
                catch { }
            }
            if (reachable == peerList.Count)
                results.Add(new("peers", "Other players reachable", CheckStatus.Pass, $"All {peerList.Count} online player(s) reachable.", null));
            else if (reachable > 0)
                results.Add(new("peers", "Other players reachable", CheckStatus.Warn,
                    $"Reached {reachable} of {peerList.Count}.",
                    "Unreachable peers may have a firewall blocking ping, or Radmin not fully connected on their side."));
            else
                results.Add(new("peers", "Other players reachable", CheckStatus.Fail,
                    $"Couldn't reach any of {peerList.Count} player(s).",
                    "Check your Radmin shows the green connected icon; a firewall may be blocking the tunnel."));
        }

        string? fc2 = FindFarCry2();
        results.Add(fc2 != null
            ? new("fc2", "Far Cry 2 found", CheckStatus.Pass, $"Found at {fc2}", null)
            : new("fc2", "Far Cry 2 found", CheckStatus.Warn,
                "Couldn't auto-detect Far Cry 2 (best-effort check).",
                "If the game runs, ignore this. Otherwise install from the group package on the Setup page."));

        results.Add(await AgentVersionCheckAsync(serverUrl));
        return results;
    }

    private static async Task<CheckResult> AgentVersionCheckAsync(string? serverUrl)
    {
        if (string.IsNullOrWhiteSpace(serverUrl))
            return new("agent", "Agent version", CheckStatus.Pass, $"Running v{AgentInfo.Version}", null);

        try
        {
            LatestRelease? latest = await Updater.FetchLatestAsync(serverUrl);
            if (latest?.Version is null)
                return new("agent", "Agent version", CheckStatus.Pass, $"Running v{AgentInfo.Version}", null);

            if (Updater.CompareSemVer(latest.Version, AgentInfo.Version) > 0)
                return new("agent", "Agent version", CheckStatus.Warn,
                    $"Running v{AgentInfo.Version}; latest is v{latest.Version}.",
                    "The agent will auto-update shortly, or right-click the tray icon → Check for updates.");

            return new("agent", "Agent version", CheckStatus.Pass,
                $"Running v{AgentInfo.Version} (up to date).", null);
        }
        catch
        {
            return new("agent", "Agent version", CheckStatus.Pass, $"Running v{AgentInfo.Version}", null);
        }
    }

    private static bool RadminAdapterExists()
    {
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            if (nic.Description.Contains("Radmin", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    private static string? FindFarCry2()
    {
        string[] roots =
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            @"C:\Games", @"D:\Games", @"C:\", @"D:\",
        };
        foreach (var root in roots)
        {
            try
            {
                foreach (var sub in new[] { "Far Cry 2", "FarCry2", @"Ubisoft\Far Cry 2" })
                {
                    var c1 = Path.Combine(root, sub, "bin", "FarCry2.exe");
                    if (File.Exists(c1)) return c1;
                    var c2 = Path.Combine(root, sub, "FarCry2.exe");
                    if (File.Exists(c2)) return c2;
                }
            }
            catch { }
        }
        if (GameDetector.IsFarCry2Running()) return "(currently running)";
        return null;
    }
}
