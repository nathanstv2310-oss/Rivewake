# Rivetwake

Start at Rivet House Estate and rotate through Saffron Canyon, Bellwether Vale and Sunspoke Depot every five minutes. The circuit repeats automatically, keeping your score across maps. Play against bots in your browser, or run the included server and invite friends. Each elimination earns 100 points. A finishing headshot earns 125.

## Estate update

- Rivet House is twice Sunspoke's width and depth, with a playable second-floor gallery, internal stairs, external ramps, an open atrium, gardens and guard houses.
- Every arena has green jump pads and four collectible abilities. Walk over a pickup to activate it for 20 seconds; it reappears after 24 seconds. Speed increases movement by 45%; spray fires faster with tighter spread; jump boost increases jump height; aim assist gently follows nearby visible targets while aiming down sights.
- Rifle damage is 18, shotgun damage is 9 per pellet, pistol damage is 24, and sniper damage remains 84. Bots react more slowly, aim less accurately and deal less damage at every difficulty.
- Weapon swaps lower and raise the gun smoothly. Aiming, recoil, camera movement and character movement use smooth transitions, with updated armour and visor details.
- On each map change, players respawn with fresh equipment and abilities reset. Scores remain. Offline pauses stop the clock; online rooms continue until everyone leaves.

## Start playing on your computer

1. Extract the **entire ZIP** into a folder. Open the folder containing `package.json`, `dist` and `server`.
2. Install Node.js 22 or newer if needed. Check the installed version with `node --version`. Three.js, the WebSocket library and the game assets are already included. [Download Node.js](https://nodejs.org/en/download)
3. On Windows, double-click `Start-Rivetwake.cmd`. On any platform, you can instead open a terminal in the extracted folder and run `node server/server.mjs` or `npm start`. Leave the server window open while you play. Press **Ctrl+C** there to stop it.
4. Open [the local game](http://localhost:3000) in desktop Chrome or Edge. Choose offline play, select a bot difficulty and start the match. Click into the arena when prompted to enable mouse aiming and sound. After extraction and Node setup, local play works without internet access.

### Controls

| Action | Input |
| --- | --- |
| Move, sprint, jump | **W A S D**, hold **Shift**, **Space** |
| Slide while moving | **C** |
| Look, fire, aim down sights | Move the mouse, **left-click**, hold **right-click** |
| Reload | **R** |
| Equip assault rifle, shotgun, sniper rifle, pistol | **1**, **2**, **3**, **4** respectively |
| Show scoreboard | Hold **Tab** |
| Release the mouse and open the pause menu | **Esc** |

Esc pauses an offline match. Online, the room clock and combat continue while your menu is open. Use **Settings** to change sensitivity, sound volume or graphics quality. If an embedded preview refuses pointer lock, cursor aiming starts automatically. Move the mouse to an edge to keep turning, or open the game in its own tab for captured aiming.

## Play together

Everyone opens the same game URL and enters a nickname in multiplayer. A room code works only on the server that created it.

- **Quick Match** finds a public room or creates one. To play with specific friends, choose **Create Room**, make it private and share its code. Friends enter it under **Join Room**.
- The lobby shows participants and their ready state. The host can fill empty slots with labelled bots. For an all-human match, leave bot fill off and invite at least two people in total. Rooms hold up to eight combatants.
- Each player marks themselves ready. The host starts the session. Players respawn after eliminations. Hold Tab to follow the standings; the shared timer counts down to the next map.

**On the same Wi-Fi**, run the server on one computer. Find its local IPv4 address with `ipconfig` on Windows. Other players open that address with port 3000, for example `http://192.168.1.23:3000`. Use your host's actual address. If a firewall prompts on the host, allow Node on your private network. For friends outside your network, publish the server below.

## Publish the website and server together

The Node process serves the browser files from `dist/`, accepts WebSocket connections at `/ws` and exposes `/healthz` for health checks. The browser automatically connects to the same host. Leave the default server address in `dist/config.js` for this setup.

1. Upload the extracted project to a Git repository. Put `package.json`, `dist/` and `server/` at the repository root. Include both vendor folders and their licences.
2. In the Render dashboard, choose **New → Web Service**, connect the repository and select the branch containing the game. Pick a region near the players. [Render web service setup](https://render.com/docs/web-services)
3. Enter the settings below. The build command checks the server entry point. The client is already built. [Render Node.js versions](https://render.com/docs/node-version)

   | Setting | Value |
   | --- | --- |
   | Language | Node |
   | Root directory | Leave blank for the repository layout above |
   | Build command | `node --check server/server.mjs` |
   | Start command | `node server/server.mjs` |
   | Environment | `NODE_VERSION` = `24.x`, `HOST` = `0.0.0.0` |
   | Port | Keep Render's supplied `PORT` |
   | Health check path | `/healthz` |
   | Instances | **1** |

4. Create the service and wait until it is live. Open the assigned HTTPS URL and try an online room. Share that **HTTPS game URL** with players. WebSocket connections use the same hostname with `wss://` and the `/ws` path. [WebSockets on Render](https://render.com/docs/websocket)

Active rooms and scores live in one server process. A restart or deployment closes current rooms. Create a fresh room afterwards. If a free Render instance has gone idle, opening its HTTPS game URL can take about a minute while the service wakes. [Render free instance behaviour](https://render.com/docs/free#spinning-down-on-idle)

## Connect a separately hosted website

1. Deploy the Node service above and open `/healthz` on its HTTPS address to confirm it is running.
2. In `dist/config.js`, set the default endpoint below, substituting the hostname Render assigned to your service. **Settings → Multiplayer server** can override the address for a single browser when testing.

   ```js
   window.RIVETWAKE_SERVER = "wss://YOUR-SERVICE.onrender.com/ws";
   ```

3. Publish **the contents of `dist/`** to your static host. The website root should contain `index.html`, `config.js`, the game modules and `vendor/`. Keep the directory structure intact. For example, in Cloudflare **Workers & Pages**, create a Pages application, select the drag-and-drop upload, drop the `dist` folder, name the project and deploy. [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/#drag-and-drop)
4. Open the static site's HTTPS URL. If your host sets a `Content-Security-Policy`, include the backend's `wss://` origin in `connect-src`. Clear any previous server override in Settings before checking the published default. Offline play runs entirely on the static site.

## Check a multiplayer deployment

1. Open the deployed game in Chrome and Edge, or use two separate browser profiles. Use different nicknames. Create a private room in one and join by code in the other. Check both names in the lobby.
2. Ready both players and start as host. Have one player move, jump and shoot while the other watches. Check hit markers, health, the kill feed, respawning, connection status and ping. Collect an ability and use a jump pad. After five minutes, check that both players enter the next map together and retain their scores.
3. Try a public room with Quick Match. Enable bot fill as host and check the bot labels. Leave from one browser and check that the other can continue.

If a friend cannot join, compare the **server address and room code** on both browsers. Check `/healthz` on the backend. In browser developer tools, the Network panel's WebSocket filter should show a successful `/ws` upgrade with status **101**. If an embedded website preview blocks mouse capture, open the game URL in its own browser tab.
