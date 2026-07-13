// The agent's two senses (SDD 7.3, 12) - both READ-ONLY by design:
// data minimization means these are the only things the agent ever looks at.
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace GameNight.Agent;

public static class GameDetector
{
    // Process.GetProcessesByName is a Win32 process-list query by exact image
    // name - we look for FarCry2 and NOTHING else (the privacy pledge, in code).
    public static bool IsFarCry2Running()
    {
        Process[] procs = Process.GetProcessesByName("FarCry2");
        foreach (var p in procs) p.Dispose();
        return procs.Length > 0;
    }
}

public static class RadminDetector
{
    private static void Log(string msg) => AgentLog.Write("detect.log", msg);

    /// <summary>
    /// The DEFINITIVE signal is a live IPv4 in 26.0.0.0/8 - if Windows assigned
    /// that address, the adapter is usable, whatever its OperationalStatus.
    /// Logs everything it sees so we can diagnose on a real machine.
    /// </summary>
    public static RadminInfo Detect()
    {
        Log("--- Detect() start ---");
        foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            foreach (UnicastIPAddressInformation ip in nic.GetIPProperties().UnicastAddresses)
            {
                if (ip.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                Log($"nic='{nic.Name}' desc='{nic.Description}' status={nic.OperationalStatus} ipv4={ip.Address}");
                if (ip.Address.GetAddressBytes()[0] == 26)
                {
                    Log($"MATCH -> {ip.Address}");
                    return new RadminInfo(true, ip.Address.ToString());
                }
            }
        }
        Log("no 26.x found -> disconnected");
        return new RadminInfo(false, null);
    }
}