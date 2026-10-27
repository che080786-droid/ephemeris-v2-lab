# 月序 Home · 我们的家 v1

`apps/ib-home.js` 在原 `#page-profile > #sec-profile-cal` 中增量挂载生活首页。「我们的家 / Desk」在此分区内横向滑动切换，顶部只保留不占行高的轻量分页圆点（仍可点击，也有可访问名称）；原桌面节点、布局设置、Space、Circle/Friends、全局导航与路由保留。样式只作用于新增区域，沿用 IB 的 serif、文字、强调色、背景与 light/dark 变量。日夜标记来自本地时间，不强制更换全局主题。

没有任何新增 AI 请求。时间和问候按本地时间分段，每分钟更新；回到前台也更新。OUR DAYS 只使用 `apiSettings.homeTogetherV1.since` 中用户明确保存的 `YYYY-MM-DD`。首次无此值时，可以读取唯一可识别的晏景好友在原 `calendarSettings.meetSet[friendId]` 中的明确日期；不使用好友创建时间、首条聊天、站点日期或随意挑选的日历纪念日。多个同名好友不猜对象。无可靠日期显示「待设置」。编辑日期使用独立本地设置，不写回原日历或 API 配置。今天及以前的有效日期才可保存；当日算第 0 天，按本地日历日期的 UTC 序号之差计算，避免夏令时偏移。

FROM YANJING · TODAY 明示「本地短句 · 非 AI 生成」。本地 `YYYY-MM-DD` 经固定哈希选取静态短句，同一天及刷新后不变，日期变化后重新选取，不写入聊天、信件或记忆。此刻状态固定「在这里」，不声称真实活动。头像读取已有用户/唯一晏景配置的主题头像，缺少图片时显示姓名首字。

Note 打开原 `sheet-notes-all` 便笺弹层，读取真实 `calNotes`；Letters 进入原 `letters` 信箱，继续使用该功能已有的行为。Album 展示 Space 中已保存的最多三张本地照片（data image/blob），保留「这里还没有照片」空状态；「Space 照片」打开原 Space。这里没有新增相册、上传系统、信件或虚构照片，也不将没有时间信息的照片标为「最新」。

`apps/ib-chat-reply-style.js` 给可识别为晏景的好友提供补充聊天风格，在 `genReply` 和群聊成员请求组装时与原 System Prompt 并存。Together 的正式对话复用 `genReply`，因此继承规则。不会写回配置、删除回复标点或修改多气泡边界、收取/停止控制器和消息/Memory 结构。其他好友不注入这段风格；具体人设与用户明确指定的表达方式仍保留。

验证：启动静态服务器后运行：

```sh
IB_TEST_BASE_URL=http://localhost:8780 python3 -B tests/test_home_v1.py
IB_TEST_BASE_URL=http://localhost:8780 python3 -B tests/test_reply_rhythm.py
```

浏览器使用隔离本地数据和拦截接口，覆盖日期来源/持久化、稳定短句/跨日、真实入口、320–430px 明暗布局、reduced motion，以及 Chat/Together 请求风格与原批次逻辑。真实 iPhone Safari 的安全区、地址栏/底栏、日期选择器、触控和真实模型表达风格仍需真机验收。

## 移动端密度调整

Home 内容左右各 12px；顶部为左对齐日期、56/64px 时间、旁侧 DAY/NIGHT 与欢迎语。普通视口时间区高 170px，高度不超过 700px 的紧凑视口为 148px。分页提示绝对定位，不另占导航行。OUR DAYS 收紧为约 176–183px，头像 38px，天数 40px，待设置文字 16px；heartbeat 占据头像之间的空间，中间仅保留一小段波形。日期和编辑入口保持轻量层级，移除重复的英文关系标签。Today 顶部间距 14/18px，Note/Letters 最小高 68px，Album 前间距 18px。没有使用容器缩放或 zoom。

原固定底栏不变，Home 末尾保留 78px 加上外层 main 已有的安全区与底部内边距。布局测试覆盖 320×568、375×667、390×664、390×744、430×932 的明暗视口及模拟安全区：首屏完整显示 OUR DAYS、Today 标题与正文开头；滚动到底后 Album 照片位于底栏上方。模拟布局不能代替真实 Safari 验收。

## Home / Desk 横向切换与视觉减法

Home 左滑进入 Desk；Desk 第一页右滑回到 Home。Desk 自己已有多页时，后续页的右滑仍先交给原桌面翻页，回到第一页再右滑进入 Home。分页圆点提供点击和键盘操作的替代入口，底部 Desk / Space / Friends / 设置不变。

触摸起点在屏幕左侧 24px 内时完全不处理，不调用 preventDefault。单指移动超过 12px 后，横向位移必须大于纵向的 1.5 倍才锁定横向意图；实际切换需达到 60px，并在结束时再次检查方向比例。纵向/斜向、多指、touchcancel、输入框/滑块/媒体控件、打开的弹层、Desk 编辑/拖拽均让位。只有可切换方向的横向 touchmove 才取消默认行为，不全局禁止滚动或设置全页 touch-action。切换用 260ms、32px 的轻微横向入场；prefers-reduced-motion 和 IB 减少动效下直接切换。容器使用局部 overflow-x:clip，不产生整页横向溢出。

两侧使用原 DOM，不刷新、不复制、不重建数据。分别记录窗口纵向位置，并在切换后恢复；保留日期编辑框未提交内容及原 Desk 节点、内部滚动和页位。仅第一次显露 Desk 时调用原布局函数测量尺寸，后续切换不派发 resize 或主动重铺桌面。没有新增数据库写入或修改日期、短句、照片、便笺和信箱逻辑。

视觉沿用原主题变量与 serif：取消 OUR DAYS 完整边框，保留淡渐变玻璃层；日期入口缩小降权且去下划线；删除重复英文关系标签；此刻信息改为相邻自然排文；便笺/信箱去顶部分割线并减少重复英文；Album 改为轻量「相册」标题，Space 入口去下划线，照片去完整细边框。OUR DAYS、FROM YANJING · TODAY 与真实来源说明保留。

自动化验证在原 Home 回归上增加边缘起点、横纵比例、60px 阈值、取消/多指/输入让位、260ms 动画、减少动效、编辑状态、窗口滚动位置和 Desk DOM/多页位置保留。模拟 TouchEvent 与 Chromium 布局不等于真实 iPhone Safari；系统返回、地址栏收放、触摸惯性和 VoiceOver 操作仍需真机验收。
