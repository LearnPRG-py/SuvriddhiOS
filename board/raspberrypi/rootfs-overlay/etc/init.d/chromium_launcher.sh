export CHROME_DATA_DIR=/root/chromium-data

exec /usr/lib/chromium-browser/chromium-browser \
    --noerrdialogs \
    --disable-infobars \
    --no-sandbox \
    --ozone-platform=wayland \
    --user-data-dir=$CHROME_DATA_DIR \
    --disable-dev-shm-usage \
    --disable-background-networking \
    --disable-sync \
    --disable-translate \
    --process-per-site \
    --js-flags="--max-old-space-size=256" \
    --purge-memory-after-idle \
    --disable-features=SafeBrowsing,Translate,BackgroundFetch,MediaRouter,WaylandFractionalScale,Vulkan,UseChromeOSDirectVideoDecoder \
    --disable-speech-api \
    --disable-speech-synthesis \
    --enable-webgl \
    --ignore-gpu-blocklist \
    --enable-features=VaapiVideoDecoder \
    --enable-accelerated-video-decode \
    --load-extension=/root/uBlock_extn \
    --load-extension=/root/h264ify \
    http://127.0.0.1:8080