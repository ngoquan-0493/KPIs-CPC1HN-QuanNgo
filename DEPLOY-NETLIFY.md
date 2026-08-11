# Deploy len Netlify

Site da duoc tao san: **saleskpi-web** (se chay o https://saleskpi-web.netlify.app)
2 bien moi truong Supabase da duoc cau hinh san tren Netlify.

## Cach deploy chuan (dung Netlify CLI - khuyen nghi)

Cach `npx @netlify/mcp` ben duoi bi loi 400 vi no nen ca node_modules (qua
nang). Dung Netlify CLI chinh thuc se on dinh hon nhieu:

1. Cai Netlify CLI (chi can lam 1 lan):
   ```powershell
   npm install -g netlify-cli
   ```

2. Dang nhap Netlify (mo trinh duyet, dang nhap bang tai khoan
   ngoquan.0493@gmail.com - chi can lam 1 lan):
   ```powershell
   netlify login
   ```

3. Lien ket thu muc nay voi site da tao san (chi can lam 1 lan):
   ```powershell
   netlify link --id 03f43e23-fb5a-4ad2-8acd-83aa7538d73e
   ```

4. Moi khi muon deploy ban moi (sau khi sua code xong), chi can chay:
   ```powershell
   netlify deploy --prod --build
   ```
   Lenh nay se tu build (bao gom ca Next.js runtime plugin de xu ly
   Server Actions, middleware dung cach) roi upload len production.
   Khong tu dong chay - chi khi ban tu go lenh nay.

---

## Cach thay the (khong khuyen nghi - de bi loi 400 do project qua nang)

Moi khi ban muon deploy ban moi (sau khi da sua code xong), mo terminal
(PowerShell hoac CMD) tai thu muc du an nay va chay:

```powershell
npx -y @netlify/mcp@latest --site-id 03f43e23-fb5a-4ad2-8acd-83aa7538d73e --proxy-path "https://netlify-mcp.netlify.app//proxy/eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..G9bDUGPgE4CZ-_nR.0ux0dV8OTIURXVm_GPPwD99viOR6DSUR-2X26LnP73PO34LIVIWRBqbsXY6uGde4dBeF03Vv1URXKZoGB3u65iytMsei02kfUkIDdQbuA2Hf0-rs-Pk3XxvAs66rmE1B_588-_a4mIij6kF55lUN4Kf9nRuHvnO4nu4ECMQkbRySE9sRfWtwC0SbKVz80yTPABmXG9uIAvZJU2Y9YYmQtfUfyeKVa5wdv7oFVSHkhH4FqnttmPXXVZT3RuuyC2cHTV8MTbhn8iO7PXGM54S0NMdgIXYuohXfazRjbX4lgkjoJXktQLvetE4F3Gg0eQeWvOZ9jLdUOViHNyaVh-r6eEYBBcbdn74tpeNemMEdVtiy4HIt8lZazXq48XpwtxpFU6Cs-2Ue.3xzuwTTpBLpKbKkNtU4C6A"
```

> Luu y: link proxy nay co han su dung ngan (vai phut). Neu chay bi loi
> "400 Bad Request" hoac tuong tu, nghia la link da het han - quay lai
> Claude va nhan "lay link deploy moi" de duoc cap link moi.

Lenh nay se tu upload code va cho Netlify build tren server cua ho (khong can
build tren may ban), sau do bao ket qua thanh cong/that bai va URL truy cap.

Luu y:
- Khong can `git push` truoc, lenh nay upload thang tu thu muc hien tai.
- Neu muon co ban sao luu code tren GitHub (an toan hon), chay `git push`
  truoc khi deploy - repo da duoc cau hinh san (`git remote -v` de kiem tra).
- Ban co the sua code bao nhieu lan tuy y - Netlify se KHONG tu deploy, chi
  deploy khi ban tu tay chay lai lenh o tren.
