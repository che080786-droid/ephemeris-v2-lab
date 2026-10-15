# 月序 Home · 我们的家 v1

`apps/ib-home.js` 在原 `#page-profile > #sec-profile-cal` 中增量挂载生活首页。顶部「我们的家 / Desk」只切换这个分区的内容；原桌面节点、布局设置、Space、Circle/Friends、全局导航与路由保留。样式只作用于新增区域，沿用 IB 的 serif、文字、强调色、背景与 light/dark 变量。日夜标记来自本地时间，不强制更换全局主题。

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

Home 内容左右各 12px；顶部为左对齐日期、56/64px 时间、旁侧 DAY/NIGHT 与欢迎语。普通视口时间区高 170px，高度不超过 700px 的紧凑视口为 148px。视图切换高 38px。OUR DAYS 收紧为约 176–183px，头像 38px，天数 40px，待设置文字 16px；heartbeat 占据头像之间的空间，中间仅保留一小段波形。关系名、日期和编辑入口保持轻量层级。Today 顶部间距 14/18px，Note/Letters 最小高 68px，Album 前间距 18px。没有使用容器缩放或 zoom。

原固定底栏不变，Home 末尾保留 78px 加上外层 main 已有的安全区与底部内边距。布局测试覆盖 320×568、375×667、390×664、390×744、430×932 的明暗视口及模拟安全区：首屏完整显示 OUR DAYS、Today 标题与正文开头；滚动到底后 Album 照片位于底栏上方。模拟布局不能代替真实 Safari 验收。
