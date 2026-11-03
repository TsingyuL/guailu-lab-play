const VISUAL_PACK_FILES = Object.freeze({
  sky: 'backgrounds/01_sky.webp',
  far: 'backgrounds/02_far.webp',
  mid: 'backgrounds/03_mid.webp',
  foreground: 'backgrounds/04_foreground.webp',
  sceneMushroom: 'backgrounds/mushroom.webp',
  sceneFossil: 'backgrounds/fossil.webp',
  sceneFossilLantern: 'backgrounds/fossil-lantern.webp',
  sceneOcean: 'backgrounds/ocean.webp',
  sceneSkyIslands: 'backgrounds/sky-islands.webp',
  sceneMoonlit: 'backgrounds/moonlit.webp',
  sceneClockwork: 'backgrounds/clockwork.webp',
  sceneClockworkIce: 'backgrounds/clockwork-ice-lite.webp',
  sceneCrystal: 'backgrounds/crystal.webp',
  sceneInverted: 'backgrounds/inverted-lite.webp',
  sceneGlowroot: 'backgrounds/glowroot.webp',
  sceneDune: 'backgrounds/dune.webp',
  sceneSnow: 'backgrounds/snow-lite.webp',
  wheel: 'sprites/wheel.webp',
  vehicleBody: 'sprites/vehicle_body.webp',
  rider: 'sprites/rider.webp',
  coin: 'sprites/coin.webp',
  fuelCan: 'sprites/fuel_can.webp',
  eyeTree: 'sprites/eye_tree.webp',
  mushrooms: 'sprites/mushrooms.webp',
  rootRock: 'sprites/root_rock.webp',
  signBlank: 'sprites/sign_blank.webp',
  rock: 'terrain/rock_wall_tile.webp',
  grass: 'terrain/grass_edge_strip.webp',
  hud: 'ui/hud_panel_default.png',
  combo: 'ui/combo_panel_default.png',
  pedalBackDefault: 'ui/pedal_back_default.png',
  pedalBackPressed: 'ui/pedal_back_pressed.png',
  pedalGasDefault: 'ui/pedal_gas_default.png',
  pedalGasPressed: 'ui/pedal_gas_pressed.png',
  jumpDefault: 'ui/jump_default.png',
  jumpPressed: 'ui/jump_pressed.png',
  pauseDefault: 'ui/pause_default.png',
  pausePressed: 'ui/pause_pressed.png',
  iconBack: 'ui/icon_back.png',
  iconGas: 'ui/icon_gas.png',
  iconJump: 'ui/icon_jump.png',
  iconPause: 'ui/icon_pause.png',
  iconFlag: 'ui/icon_flag.png',
  iconFuel: 'ui/icon_fuel.png',
  iconCoin: 'ui/icon_coin.png'
});
// iPhone 微信小游戏的 Canvas 图片解码对 WebP 支持不一致；发行包使用 JPEG / PNG。
const TRANSPARENT_ASSETS = new Set(['far', 'mid', 'foreground', 'grass', 'wheel', 'vehicleBody', 'rider', 'coin', 'fuelCan', 'eyeTree', 'mushrooms', 'rootRock', 'signBlank']);
const NATIVE_VISUAL_PACK_FILES = Object.freeze(Object.fromEntries(
  Object.entries(VISUAL_PACK_FILES).map(([name, file]) => [name, file.replace(/\.webp$/, TRANSPARENT_ASSETS.has(name) ? '.png' : '.jpg')])
));

function loadImage(platform, source) {
  return new Promise((resolve, reject) => {
    let image;
    try {
      image = platform.createImage();
    } catch (error) {
      reject(error);
      return;
    }
    image.onload = () => resolve(image);
    image.onerror = error => reject(new Error(`素材加载失败: ${source}${error?.message ? ` (${error.message})` : ''}`));
    image.src = source;
  });
}

async function loadVisualPack(platform, basePath = 'assets/wildroad-pack-v1') {
  if (!platform || typeof platform.createImage !== 'function') throw new Error('当前平台不支持图片加载');
  const entries = Object.entries(platform.native ? NATIVE_VISUAL_PACK_FILES : VISUAL_PACK_FILES);
  const images = {}, failed = [];
  let next = 0;
  // 真机图片解码资源有限；少量并发且逐张容错，避免一张失败让整套素材消失。
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
    while (next < entries.length) {
      const [name, file] = entries[next++];
      try { images[name] = await loadImage(platform, `${basePath}/${file}`); }
      catch (error) { failed.push({ name, message: error.message }); }
    }
  }));
  return { ready: Object.keys(images).length > 0, images, failed };
}

module.exports = { VISUAL_PACK_FILES, NATIVE_VISUAL_PACK_FILES, loadVisualPack };
