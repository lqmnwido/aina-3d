# Local Cloudflare Tunnel

The public site is served from your running PC, not uploaded to Cloudflare Pages. Keep `npm run local` running and the PC connected.

## Set up another machine / hostname

Install cloudflared and follow [Cloudflare's official locally managed tunnel guide](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/).

```sh
cloudflared tunnel login
cloudflared tunnel create aina
cloudflared tunnel route dns aina aina.example.com
```

The create command prints the tunnel UUID and credentials JSON location.

1. Copy `config.example.yml` to `config.yml` in this folder.
2. Replace YOUR-TUNNEL-UUID and hostname with your own values.
3. Copy the generated tunnel credentials JSON to `cloudflare/credentials.json`.
4. Keep service port consistent with PORT in the app .env.
5. Run `npm run local` from the app or repository root.

The launcher runs cloudflared with the app as its working directory, so the example relative credentials path works. Optional `AINA_PUBLIC_URL` overrides the URL checked by the launcher; otherwise it reads the config hostname.

Do not replace another hostname's DNS record. Existing gimmick.kohich.site uses this PC's private tunnel configuration, which is deliberately not committed. On another machine you need its authorized credentials or your own tunnel. Config/credentials/certificates/.env/logs must never be published.

If using a separately managed tunnel, run `npm start` to serve the app only and manage cloudflared yourself. Do not copy config.yml if you want local-only use.

Cloudflare 1033 means the public tunnel is unavailable; it does not indicate a broken GLB or audio file.
