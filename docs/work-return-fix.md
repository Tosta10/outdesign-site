# 作品歸位過渡修正

日期：2026-10-23

## 範圍

處理「選中作品後回到作品陣列，畫面短暫解除渲染／突然跳回」的連續性問題。保留作品頁現有操作、UI、相機構圖及畫質設定；其餘低階設備效能研究仍暫緩。

## 原因

1. 進入 `browse` 的第一幀，`reveal` 即被清成 0，正在歸位中的玻璃／圖像材質又立即被指定為 `.3`。作品雖仍在移動，已清晰的封面卻突然重新霧化。
2. 陣列使用 `detail < .995` 的二元顯示判定。詳細模式會整批隱藏陣列並把 instance count 寫成 0；返回時跨過該值才一次恢復，造成背景突然出現。
3. 切換選中項目時，退回原位的舊模型也會每幀降低揭示值，出現相同的霧化重置。

## 修改

- 歸位期間保留當下已完成或部分完成的材質揭示。直到模型交回陣列、模型本身隱藏後，才重設下一次開啟的揭示動畫。
- 陣列根據鏡頭過渡進度連續恢復覆蓋率；使用 Three.js 的 alpha hash 保持深度排序，極低不可見覆蓋率才暫停繪製，避免原本 `.995` 閾值的突然出現。
- 舊模型退回時保留原有封面清晰度。介面揭示進度仍可立即歸零，不會延後返回操作。
- 增加 `data-archive-presence`／`data-model-reveal`，方便以實際完成的渲染幀驗證，而非以滑鼠事件或定時器推估畫面。

## 驗證

- `node --test tests/work-return.test.ts tests/work-lab.test.ts`：13 項通過，新增 3 項針對 5／30／60／120 Hz 歸位、舊閾值連續性、途中取消再開啟。
- `pnpm check`：78 個檔案，0 errors／warnings／hints。
- 隔離臨時資料及獨立 Astro／API 連接埠，未存取或改寫使用者 `.local` 資料。
- Edge 硬體 WebGL：1440／390 px 分別取得 65／70 個實際歸位幀，均通過逐幀歸位檢查。
- Edge SwiftShader：1440／390 px 分別取得 40／35 個實際歸位幀；歸位中的模型揭示值保持 1，陣列從 0 經中間值回到 1。
- 重開同一作品會重新播放原有揭示；減少動態模式可正常立即歸位；無 JavaScript runtime errors。

檢查腳本及逐幀資料保留於本機忽略目錄：

- `artifacts/work-return-check.mjs`
- `artifacts/work-return-hardware-results.json`
- `artifacts/work-return-software-results.json`
- `artifacts/work-return-hardware-1440-array.png`
- `artifacts/work-return-software-390-array.png`

本修正未變動畫質解析度策略，亦未包含網站部署。
