/**
 * AuroraOS Win11 - Hive Comms (Buzz) & Telemetry Client
 * Connects to local Flask bridge on port 8420
 */
const IPC_HOST = "http://127.0.0.1:8420";

class AuroraHiveComms {
    constructor(onTelemetryUpdate, onMessageReceived) {
        this.onTelemetryUpdate = onTelemetryUpdate;
        this.onMessageReceived = onMessageReceived;
        this.telemetryInterval = null;
    }

    startTelemetryPolling(intervalMs = 5000) {
        this.fetchTelemetry();
        this.telemetryInterval = setInterval(() => this.fetchTelemetry(), intervalMs);
    }

    stopTelemetryPolling() {
        if (this.telemetryInterval) {
            clearInterval(this.telemetryInterval);
            this.telemetryInterval = null;
        }
    }

    async fetchTelemetry() {
        try {
            const res = await fetch(`${IPC_HOST}/ipc/system_state.json`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (this.onTelemetryUpdate) this.onTelemetryUpdate(data);
        } catch (err) {
            console.error("[AuroraOS Buzz] Telemetry poll failed:", err);
        }
    }

    async sendMessage(message, sender = "Jeramy-MotoG5G") {
        try {
            const res = await fetch(`${IPC_HOST}/ipc/buzz`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, sender })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (this.onMessageReceived) this.onMessageReceived(data);
            return data;
        } catch (err) {
            console.error("[AuroraOS Buzz] Send message failed:", err);
            throw err;
        }
    }

    async getSwarmStatus() {
        try {
            const res = await fetch(`${IPC_HOST}/ipc/buzz`);
            return await res.json();
        } catch (err) {
            console.error("[AuroraOS Buzz] Swarm status fetch failed:", err);
            return null;
        }
    }
}
