# 玻璃卡帶作品展示：來源分析與實作對照

分析來源：使用者提供的 RhineLabUI-main.zip（約 114 MB）。來源文件中的工作指示僅作為待分析資料，沒有作為本專案的執行指令，也未執行壓縮包的安裝或發布腳本。

## 原專案的技術棧

原始 package.json 使用 TypeScript 5.9.3、Three.js 0.183 系列、Vite 7.3.1；另外使用 @kitlangton/rolling-number 0.4.1。主體是直接操作 DOM 的 TypeScript 應用，沒有 React 或 Vue。GLB 模型由 Blender 工程輸出；Web 版本包含 PWA，另有與 Wallpaper Engine 相關的宿主整合。

README 明確說明視覺參考自既有遊戲宣傳影像。倉庫的 MIT 授權說明的是軟體授權，不能據此假定品牌、美術、字型或影像參考具有同等的使用權。本次不使用該來源的模型、圖片、音訊、品牌、字型、字形路徑與原影片的逐幀標誌軌跡。

## 架構與效果的形成方式

| 模組 | 分析結論 | OutDesign 中的對應 |
| --- | --- | --- |
| main.ts | 總控狀態、檢索、收藏、讀取頁籤、輸入與視圖協調 | index.ts 管理 DOM 與作品狀態，與渲染器分離 |
| scene.ts | 即時陣列、抽取、相機、材質、陰影與後處理 | scene.ts 依狀態更新矩陣、相機和玻璃 |
| motion.ts | 空間波包、相鄰傳播、指數阻尼與精確歸位 | state.ts 的有界波形與與幀率無關的指數收斂 |
| archive-loop.ts | 有限物件池配合無界邏輯索引，循環期間避免反向跳動 | 有限 InstancedMesh 池與循環作品索引 |
| archive-drag.ts | 螢幕拖曳投影、速度取樣、滑行與吸附分離 | Pointer Events、速度取樣、衰減滑行後吸附 |
| boot*.ts | DOM/SVG 與時間軸協調，含逐字、繪線和開場切換 | 原創菱形繪線、校準字樣與可略過的短開場 |
| decryption.ts / glass-reveal.ts | 同一進度驅動材質粗糙度與文字揭示 | 玻璃高度 shader 與文件遮罩共用 reveal |
| model-viewer.ts / viewer-camera.ts | 360° 視角、平移、縮放、復位與六組構件拆解 | 卡帶六組構件與平面作品圖；拖曳、捏合、平移和復位 |
| shared-depth.ts | 透過自訂 MRT 將 AO 法線與 packed depth 共用給景深 | 未移植對引擎內部方法的覆寫，改用官方 SSAOPass、BokehPass |
| quality-renderer.ts | 解析度、陰影、折射採樣及品質預設 | 省電／標準／精細三級，精細啟用 AO／景深 |
| three-resources.ts | 幾何、材質與共享貼圖去重銷毀 | 場景資源去重釋放、事件與觀察器清理 |
| audio.ts | 多軌聲音、事件音效、音樂律動 | 自行合成短音與環境音，不載入任何來源音檔 |
| motion-preferences.ts | 全域及分項減少動態控制 | 系統減少動態、使用者開關、靜態時按需渲染 |
| theme-motion.ts / ui-transitions.ts | 連續配色與可取消轉場，避免快速反向操作遺留動畫 | DOM 動畫先取消再重設，場景狀態連續收斂 |

原作品對視窗投影、陰影 draw coverage、共用深度精度和片段運算做了非常細的效能設計。這些最佳化高度依賴原場景、GLB 和 Three 版本，不能直接假設移到另一個場景仍然有效；本次使用較小的幾何與有限實例池，保留清楚的品質邊界與降級路徑。

## 最終作品形式

依使用者後續指定，入口是「左側玻璃卡帶、右側作品資料」的詳情介面，不是把幾何研究當成正式作品。真正的作品欄位仍沿用既有作者模式與後端 schema。

封面只建立一個 PlaneGeometry，貼合卡帶表面；圖像薄膜與玻璃共用揭示進度，避免重複折射使作品模糊。圖片以 contain 等比例畫到 CanvasTexture，保留整張內容，不轉成浮雕或立體模型。卡帶轉動時，封面與外殼共用父節點；拆解時，圖片平面與蓋板、襯底等各自移動。作品編號採 NO.001、NO.002 依清單順序產生。收藏使用原始 UUID，不會因排序而指向另一件作品。

卡帶框架、固定構件、標籤、空清單占位圖與驗證用封面均為本次自行製作。未下載外部美術素材，也未打包任何 web 字型；文字使用使用者作業系統的 system-ui／monospace。

## 本專案的模組邊界

- WorkLab.tsx：伺服器輸出可閱讀的作品資料、控制項與備援封面；支援作者選取作品。
- work-lab/state.ts：作品資料轉接、空清單、循環索引、波形、偏好驗證。
- work-lab/index.ts：狀態、搜尋、收藏、匯出、模態對話框、指標／鍵盤／手把輸入、生命週期。
- work-lab/scene.ts：按需載入的 Three.js，實例陣列、圖集、相機、材質、後處理、螢幕尺寸與可見性。
- work-lab/geometry.ts：自行建立卡帶模型，異步封面載入、平面圖像、玻璃 shader、資源釋放。
- work-lab/audio.ts：使用者啟用後才建立 Web Audio 合成音。
- work-lab.css：模組內的介面、明暗配色與容器自適應。

首頁與其他分頁不會載入 Three.js；作者編輯狀態不啟動 3D，預覽狀態才啟動。失去可見性或切到其他分頁會停止渲染。WebGL 不可用時保留真實封面、文字資料、搜尋、收藏與匯出。

PWA、Wallpaper Engine、桌面宿主、日程與系統媒體等不屬於此網站作品展示的功能，沒有引入。

## 查核依據

Three.js 官方文件：
- https://threejs.org/docs/pages/WebGLRenderer
- https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- https://threejs.org/manual/pages/rendering-on-demand.html
- https://threejs.org/manual/pages/responsive.html

新的 Three.js 和型別套件固定為 0.183.0，以與參考實作的 API 世代保持一致；沒有複製其 postinstall 或引擎 patch。
