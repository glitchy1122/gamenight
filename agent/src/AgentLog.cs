// Shared append-only logging under %LOCALAPPDATA%\GameNight.
// Full timestamps so Housekeeping can drop lines older than 24 hours.
namespace GameNight.Agent;

public static class AgentLog
{
    public static void Write(string fileName, string message)
    {
        try
        {
            Directory.CreateDirectory(AgentConfig.DataDir);
            string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}\r\n";
            File.AppendAllText(Path.Combine(AgentConfig.DataDir, fileName), line);
        }
        catch { /* logging must never crash the agent */ }
    }
}
