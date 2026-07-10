// The agent's entire UI (SDD §12): a tray icon and a few menu items.
// The real dashboard is the website; the agent stays invisible.
namespace GameNight.Agent;

public sealed class TrayIcon : IDisposable
{
    private readonly NotifyIcon _icon;
    private readonly ContextMenuStrip _menu;
    private readonly ToolStripMenuItem _status;
    private bool _paused;
    private string _connectionStatus = "starting…";
    public event Action<bool>? PauseToggled;
    public event Action? UpdateCheckRequested;

    public TrayIcon(string serverUrl, ServerLink link)
    {
        var menu = new ContextMenuStrip();
        _menu = menu;
        _status = new ToolStripMenuItem(StatusLabel()) { Enabled = false };
        var version = new ToolStripMenuItem($"Version {AgentInfo.Version}") { Enabled = false };
        var pause = new ToolStripMenuItem("Pause monitoring");
        var checkUpdate = new ToolStripMenuItem("Check for updates");
        menu.Items.Add(_status);
        menu.Items.Add(version);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Open dashboard", null, (_, _) =>
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(serverUrl) { UseShellExecute = true }));
        menu.Items.Add(checkUpdate);
        menu.Items.Add(pause);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => Application.Exit());

        checkUpdate.Click += (_, _) => UpdateCheckRequested?.Invoke();

        pause.Click += (_, _) =>
        {
            _paused = !_paused;
            pause.Text = _paused ? "Resume monitoring" : "Pause monitoring";
            PauseToggled?.Invoke(_paused);
        };

        // BeginInvoke needs a native handle; a ContextMenuStrip only creates
        // one when first opened. Force it now, or early status updates throw.
        _ = menu.Handle;

        _icon = new NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Text = TipText(),
            Visible = true,
            ContextMenuStrip = menu,
        };

        link.StatusChanged += s =>
        {
            try
            {
                menu.BeginInvoke(() =>
                {
                    _connectionStatus = s;
                    _status.Text = StatusLabel();
                    _icon.Text = TipText();
                });
            }
            catch { /* UI cosmetics must NEVER kill the connection loop */ }
        };
    }

    private string StatusLabel() => _connectionStatus;

    // NotifyIcon.Text max is 63 chars on Windows.
    private string TipText()
    {
        string tip = $"GameNight v{AgentInfo.Version} — {_connectionStatus}";
        return tip[..Math.Min(63, tip.Length)];
    }

    /// <summary>Show a native Windows toast (balloon tip). Phase 4.</summary>
    /// Safe to call from any thread — marshals to the UI thread via the menu.
    public void ShowToast(string title, string body)
    {
        void Show()
        {
            try
            {
                _icon.BalloonTipTitle = title;
                _icon.BalloonTipText = body;
                _icon.BalloonTipIcon = ToolTipIcon.Info;
                _icon.ShowBalloonTip(5000);
            }
            catch { /* toast is best-effort; never crash on it */ }
        }
        try
        {
            if (_menu.InvokeRequired) _menu.BeginInvoke(Show);
            else Show();
        }
        catch { /* if the handle isn't ready, silently skip this toast */ }
    }

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.Dispose();
    }
}
