// Log + update-artifact cleanup (Phase 5 housekeeping).
// Keeps only the last 24 hours of *.log lines under DataDir, and deletes stale
// download partials so a friend's disk doesn't fill up over a long campaign.
namespace GameNight.Agent;

public static class Housekeeping
{
    public static readonly TimeSpan Retention = TimeSpan.FromHours(24);

    /// <summary>Trim logs and stale update files. Safe to call from any thread.</summary>
    public static string Run()
    {
        try
        {
            Directory.CreateDirectory(AgentConfig.DataDir);
            DateTime cutoff = DateTime.Now - Retention;
            int kept = 0, dropped = 0;
            long bytesFreed = 0;

            foreach (string path in Directory.EnumerateFiles(AgentConfig.DataDir, "*.log"))
            {
                var result = TrimLogFile(path, cutoff);
                kept += result.Kept;
                dropped += result.Dropped;
                bytesFreed += result.BytesFreed;
            }

            string updateDir = Path.Combine(AgentConfig.DataDir, "update");
            if (Directory.Exists(updateDir))
            {
                foreach (string path in Directory.EnumerateFiles(updateDir))
                {
                    string name = Path.GetFileName(path);
                    // Never touch the live swap helper if an update is mid-flight;
                    // only clear abandoned partials / pending downloads.
                    bool staleName = name.Contains(".partial", StringComparison.OrdinalIgnoreCase)
                        || name.EndsWith(".pending.exe", StringComparison.OrdinalIgnoreCase);
                    if (!staleName) continue;
                    try
                    {
                        var info = new FileInfo(path);
                        if (info.LastWriteTime > cutoff) continue;
                        long size = info.Length;
                        info.Delete();
                        bytesFreed += size;
                    }
                    catch { /* best effort */ }
                }
            }

            string summary = $"housekeeping: kept {kept} lines, dropped {dropped}, freed {bytesFreed} bytes";
            AgentLog.Write("update.log", summary);
            return summary;
        }
        catch (Exception ex)
        {
            string fail = $"housekeeping failed: {ex.Message}";
            AgentLog.Write("update.log", fail);
            return fail;
        }
    }

    private static (int Kept, int Dropped, long BytesFreed) TrimLogFile(string path, DateTime cutoff)
    {
        long before = new FileInfo(path).Length;
        string[] lines;
        try { lines = File.ReadAllLines(path); }
        catch { return (0, 0, 0); }

        var keptLines = new List<string>(lines.Length);
        int dropped = 0;
        foreach (string line in lines)
        {
            if (line.Length == 0) continue;
            if (TryParseLogTimestamp(line, out DateTime ts))
            {
                if (ts >= cutoff) keptLines.Add(line);
                else dropped++;
            }
            else
            {
                // Legacy HH:mm:ss-only lines (no date) — age unknown; drop them.
                dropped++;
            }
        }

        // Avoid rewriting when nothing changed.
        if (dropped == 0 && keptLines.Count == lines.Length)
            return (keptLines.Count, 0, 0);

        string tmp = path + ".housekeeping";
        try
        {
            File.WriteAllLines(tmp, keptLines);
            File.Copy(tmp, path, overwrite: true);
            File.Delete(tmp);
        }
        catch
        {
            try { if (File.Exists(tmp)) File.Delete(tmp); } catch { }
            return (keptLines.Count, dropped, 0);
        }

        long after = File.Exists(path) ? new FileInfo(path).Length : 0;
        long freed = Math.Max(0, before - after);
        return (keptLines.Count, dropped, freed);
    }

    /// <summary>Accepts "yyyy-MM-dd HH:mm:ss …" at the start of a log line.</summary>
    public static bool TryParseLogTimestamp(string line, out DateTime timestamp)
    {
        timestamp = default;
        // "yyyy-MM-dd HH:mm:ss" is 19 chars.
        if (line.Length < 19) return false;
        return DateTime.TryParseExact(
            line.AsSpan(0, 19),
            "yyyy-MM-dd HH:mm:ss",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out timestamp);
    }
}
