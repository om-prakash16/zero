import sys
import time
import os
import httpx

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

SERVER_URL = os.getenv("FASTAPI_BACKEND_URL", "http://127.0.0.1:8000")

def render_dashboard(data: dict):
    # Clear screen
    os.system("cls" if os.name == "nt" else "clear")

    cache = data.get("cache", {})
    rooms = data.get("rooms", {})

    print("=" * 72)
    print("      CROSSWIRE REAL-TIME PYTHON ENGINE - LIVE TELEMETRY DASHBOARD      ")
    print("=" * 72)
    print(f"  Service:               CROSSWIRE AI Engine v2.0")
    print(f"  Backend Runtime:       Python {data.get('python_version', sys.version.split()[0])} ({data.get('framework', 'FastAPI')})")
    print(f"  Uptime:                {data.get('uptime_human', 'N/A')}")
    print(f"  Status:                ONLINE (http://127.0.0.1:8000)")
    print("-" * 72)
    print("  [PERFORMANCE METRICS]")
    print(f"    • Total Translations Served:   {data.get('total_translations_served', 0)}")
    print(f"    • Total Speech Recognitions:   {data.get('total_speech_recognitions', 0)}")
    print(f"    • Total Voice Dubbings:        {data.get('total_voice_syntheses', 0)}")
    print(f"    • Average Latency:             {data.get('average_latency_ms', 0)} ms")
    print(f"    • P95 Latency:                 {data.get('p95_latency_ms', 0)} ms")
    print("-" * 72)
    print("  [IN-MEMORY LRU SENTENCE CACHE]")
    print(f"    • Cached Utterances:           {cache.get('entries_cached', 0)} / {cache.get('max_capacity', 3000)}")
    print(f"    • Cache Hits:                  {cache.get('cache_hits', 0)}")
    print(f"    • Cache Misses:                {cache.get('cache_misses', 0)}")
    print(f"    • Hit Ratio:                   {cache.get('hit_ratio_percent', 0.0)}%")
    print("-" * 72)
    print("  [ACTIVE VIDEO MEETINGS & SESSIONS]")
    print(f"    • Active Rooms:                {rooms.get('active_rooms_count', 0)}")
    print(f"    • Connected Peers:             {rooms.get('total_connected_peers', 0)}")
    print("=" * 72)
    print("  Interactive OpenAPI Docs: http://127.0.0.1:8000/docs")
    print("  Press Ctrl+C to exit monitor.\n")

def main():
    print(f"Connecting to Python engine at {SERVER_URL}...")
    with httpx.Client(timeout=3.0) as client:
        while True:
            try:
                res = client.get(f"{SERVER_URL}/api/metrics")
                if res.status_code == 200:
                    render_dashboard(res.json())
                else:
                    print(f"Waiting for Python backend... (HTTP {res.status_code})")
            except Exception as e:
                print(f"Python backend is offline or loading: {e}. Retrying in 2s...")
            time.sleep(2)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExited monitor.")
