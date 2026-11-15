# Huddle 🎮

A living-room party console. Your laptop is the console: plug it into the TV, or open it in the TV's browser. Everyone's phone becomes a motion controller.

## Start it

```bash
cd ~/Huddle
npm install      # first time only
npm start
```

You can also double-click **Start Huddle.command**.

- **TV screen:** opens at `http://localhost:3000`. Click once to start (this turns on sound and full screen). Press **F** to toggle full screen.
- **On a smart TV's browser instead:** open the `http://<laptop-ip>:3000` address printed in the terminal.
- **Phones:** scan the QR code on the menu. Phones must be on the same Wi-Fi as the laptop.

### The certificate warning on phones

Phones only allow motion sensors on secure (https) pages, so Huddle makes its own certificate. The first time you open the link, the phone warns you:

- **iPhone:** tap *Show Details* → *visit this website* → *Visit Website*. Then tap **Join** and allow *Motion & Orientation*.
- **Android:** tap *Advanced* → *Proceed*.

If you skip motion, everything still works with touch controls.

## Controls

| Phone | Does |
|---|---|
| Point the phone / drag on the pad | moves your cursor |
| **A** (or tap the pad) | select / fire |
| **B** | back |
| **⌂** | pause menu |
| ⚙︎ | rename, motion on/off, sensitivity, invert |

If the cursor drifts, push it against the edge of the screen to re-centre it.

## Games

| Game | Players | How |
|---|---|---|
| **Balloon Blitz** | 1–8, all at once | Point and press A to pop balloons. Gold is worth +5, black is −3 |
| **Strike Lane** | 1–8, taking turns | Drag to line up, then swipe up or swing your arm to bowl |
| **Shake Dash** | 1–8, all at once | Shake your phone (or tap fast) to sprint 100 m |
| **Sundown Showdown** | 1–8, all at once | Tap when it says DRAW. Tap early and you're out for the round |
| **Tick Tock Bomb** | 2–8 | Tap 3× to throw the bomb on. Don't be holding it when it blows |
| **Bumper Bash** | 2–8, all at once | Tilt (or drag the joystick) to roll and press DASH to charge. Knock everyone off the shrinking arena |
| **Brain Buzz** | 1–8, all at once | 10 quiz questions answered on your phone. Faster correct answers score more |
| **Splat Turf** | 1–8, all at once | Point to paint the floor your colour. A drops a paint bomb |
| **Pump & Pop** | 1–8, all at once | Hold to pump, let go to bank. Each balloon has a secret popping point |
| **Turbo Tracks** | 1–8 (+ CPU racers) | Kart racing on 3 tracks or a 3-race Grand Prix. Steer by turning your phone like a wheel. Grab item orbs for Turbo, Goo, Shockwave or Shield |

## Adding a game

Create `public/tv/games/mygame.js` and call `Huddle.register({ id, name, desc, controls, minPlayers, preview(ctx,w,h,t), create(api, players) })`. Then add a `<script>` tag for it in `public/tv/index.html`. The other game files show how it works:

- `create` returns `{ update(dt), draw(ctx,t), input(player, msg) }`.
- Phone messages are `{t:'btn',b:'a',d:true}`, `{t:'p',dx,dy}`, `{t:'shake',s}`, `{t:'swing',power,curve,spin}`, `{t:'tilt',x,y}`, `{t:'dash'}`, `{t:'choice',i}`, `{t:'steer',s}` and `{t:'item'}`.
- `api.setMode(mode, hint, ids?, {text})` switches the phone layout: `pointer`, `shake`, `swing`, `buzzer`, `bomb`, `tilt`, `choice` (pass `{options:[…4]}`), `drive` (pass `{item}`) or `wait`.
- `api.end(results)` shows the results screen.

The TV can draw up to 12 menu tiles.
