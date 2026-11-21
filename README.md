# Lumen Heist — best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/idn45-agent/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/idn45-agent/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Entry untuk bounty make.fun ["Make the best stealth game"](https://make.fun/bounty/best-stealth-game-20261121-1759): **Lumen Heist**, game stealth top-down orisinal. Kamu pencuri sunyi bernama Wren yang menyelinap ke museum malam hari untuk mencuri Moon Opal di tiga aula — melewati penjaga dengan vision cone yang memantul di dinding, bersembunyi di semak dan di balik etalase, merayap lewat bayangan, dan melempar kerikil untuk mengalihkan perhatian. Ketahuan berarti alarm, kejar-kejaran, dan satu nyawa hilang.

## Cara main

- **WASD / panah** — bergerak
- **Shift** — lari (cepat tapi berisik, radius suara terlihat)
- **C** — menyelinap (lambat, sulit terlihat)
- **Klik mouse** — lempar kerikil ke arah kursor (penjaga menyelidiki bunyinya)
- **P** — jeda · **Enter** — mulai / ulangi

Sistem deteksi: meter penjaga naik saat kamu terlihat di dalam cone-nya — lebih cepat dari dekat, lebih lambat di bayangan, tidak naik sama sekali saat kamu di dalam semak. Di atas ambang, penjaga curiga dan menoleh ke arahmu; penuh berarti alarm dan ia mengejarmu. Langkah kaki penjaga yang dekat terdengar, jadi kamu bisa mendengar patroli yang datang tanpa melihatnya. Tertangkap tiga kali berarti permainan berakhir.

## Run

```sh
node serve.ts   # mainkan di http://localhost:8080
node main.ts    # menyalin game/ + screenshots/ ke output dan menulis dossier.json
```

Semua aset dibuat sendiri di kode: tanpa library, tanpa network request, suara disintesis dengan WebAudio.

Daftar make.fun lewat referral kami: https://make.fun/r/1bdkx9mj
