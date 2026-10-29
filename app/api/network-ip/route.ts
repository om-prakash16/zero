import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const nets = os.networkInterfaces();
  let detectedIp = '10.178.253.51'; // reliable fallback

  // Prioritize active Wi-Fi / Ethernet non-internal IPv4
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (
        net.family === 'IPv4' &&
        !net.internal &&
        !net.address.startsWith('169.254') &&
        !net.address.startsWith('127.')
      ) {
        detectedIp = net.address;
        break;
      }
    }
  }

  return NextResponse.json({
    ip: detectedIp,
    webPort: 3000,
    backendPort: 8000,
    webUrl: `http://${detectedIp}:3000`,
    backendUrl: `http://${detectedIp}:8000`,
    status: 'online',
  });
}
