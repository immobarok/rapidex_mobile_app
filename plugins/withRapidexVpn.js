const fs = require('node:fs');
const path = require('node:path');

function loadConfigPlugins() {
  try {
    return require('expo/config-plugins');
  } catch {
    return require('@expo/config-plugins');
  }
}

const { AndroidConfig, withAndroidManifest, withDangerousMod } = loadConfigPlugins();

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const OPENVPN_SERVICE_NAME = 'de.blinkt.openvpn.core.OpenVPNService';

function withOpenVpnAndroidManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    for (const permission of permissions) {
      AndroidConfig.Permissions.addPermission(manifest, permission);
    }

    const mainApplication =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    mainApplication.$ = mainApplication.$ ?? {};
    if (!mainApplication.$['android:extractNativeLibs']) {
      mainApplication.$['android:extractNativeLibs'] = 'true';
    }

    const services = Array.isArray(mainApplication.service)
      ? mainApplication.service
      : [];
    const hasOpenVpnService = services.some(
      (service) => service?.$?.['android:name'] === OPENVPN_SERVICE_NAME
    );

    if (!hasOpenVpnService) {
      services.push({
        $: {
          'android:name': OPENVPN_SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.net.VpnService',
                },
              },
            ],
          },
        ],
      });
      mainApplication.service = services;
    }

    return modConfig;
  });
}

function withNetworkSecurityXml(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const targetFile = path.join(xmlDir, 'network_security_config.xml');
      if (!fs.existsSync(targetFile)) {
        fs.writeFileSync(targetFile, NETWORK_SECURITY_XML, 'utf8');
      }
      return modConfig;
    },
  ]);
}

/**
 * Configures Android resources (`network_security_config.xml`) and registers
 * OpenVPNService + native library extraction flags during `expo prebuild`.
 */
function withRapidexVpn(config) {
  let updated = withOpenVpnAndroidManifest(config);
  updated = withNetworkSecurityXml(updated);
  return updated;
}

module.exports = withRapidexVpn;

