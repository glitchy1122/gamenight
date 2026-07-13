// Append-only logs under %LOCALAPPDATA%\GameNight (dated lines for housekeeping).
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
