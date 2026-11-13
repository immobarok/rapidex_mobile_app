export type VpnStatus = 'disconnected' | 'connecting' | 'connected';

export type VpnProtocol = 'WireGuard' | 'IKEv2';

export type VpnServer = {
  id: string;
  country: string;
  city: string;
  code: string;
  latencyMs: number;
  loadPercent: number;
  ipMask: string;
};
