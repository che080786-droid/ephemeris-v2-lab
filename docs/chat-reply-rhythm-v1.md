# 连续发送与手动收取回复 v1

Chat 和 Listen Together 的输入区都保留发送按钮，并新增 44px 的 `✦` 按钮。发送只保存当前一条消息、生成独立用户气泡并清空草稿。没有待回复消息时 `✦` 禁用；点击它才开始一轮请求，请求中按钮变为 `■`。输入框与原发送键始终可用。

## 共用的批次规则

`apps/ib-reply-rhythm.js` 共用待处理队列、不可变提交边界、AbortController、多气泡解析、依次保存与按钮状态。Chat adapter 和房间 adapter 仅负责各自的数据、显示、上下文与存储。

- 普通 Chat 按 `chat:[friendId,threadId]` 隔离。点击收取时复制本轮历史与待处理 ID；即使生成期间发送更多消息，也不改变这个快照。完整待处理批次不会被普通 history 条数上限截掉。
- Listen Together 按 `listen:[mateId,roomSessionId]` 隔离。房间 session ID 存在当前标签页的 sessionStorage；切换伙伴后使用另一份 session，回到原伙伴仍可收取原房间的消息。音乐/对话模式切换不销毁队列或取消请求。
- 失败或停止时，若还没有保存气泡，整批恢复待收取；如果已有气泡保存，本批视为已经回应，停止剩余气泡，避免将已回答的整批再次提交。期间新发的消息一直留在下一轮。
- 离开会话、切换 thread、关闭房间或切换伙伴会中止所属请求。每个气泡落库前检查请求/会话有效性，不向新会话继续插入旧气泡。
- 已保存气泡带可选 `replyBatch` 回执，记录 namespace 与提交 ID。它与气泡一起保存，用于恢复边界；不增加数据库版本或表。localStorage 中的队列提示可丢失或不可写，已提交回执仍能区分“本批已回复”和“生成期间新发的消息”。

## 请求、输出与保存

两边正式请求均走原 `genReply → callAIC → callAI`，使用原 API 配置、system prompt、history、summary、memory/Auto Memory、provider 与错误处理。Together 通过 adapter 传入房间历史、保存回调和内部场景上下文：歌曲 title/artist、当前歌词、播放或暂停、播放时间、伙伴及 room session。场景资料不写成用户聊天消息，也不调用播放/暂停/切歌方法。

新增的输出协议为 `{"messages":["自然回复"]}`，要求 1～4 个非空字符串，短回答一条即可。结构化输出期间缓冲流式内容，避免向气泡展示 JSON 语法；收到完整响应后解析并逐条保存。无效 JSON、数量错误、空字符串等均降级为保留完整原文的单气泡，不吞回复。

每条 assistant 气泡具有独立 ID 与单调时间戳。默认间隔 350ms；系统 prefers-reduced-motion 或应用 ib-reduce 开启时取消间隔。原用户消息保持多个独立数据库记录，只有 provider 的历史转换可能合并相邻同角色传输内容，不写回虚构的合并用户消息。

普通 Chat 沿用 `chatMessages` 和 `saveAi`。Together 消息在原 `apiSettings` 通用存储中使用独立 `listen_chat_v1:<session>` 记录，内含独立消息对象；不是 API 配置，不写入普通 Chat 消息列表。关闭后重开、当前标签页刷新后可恢复已保存消息和边界。普通消息发送、语音发送使用手动收取；其他应用调用的 `sendQuickText` 继续保留其原有调用语义。

`?ib-ai-mock=1` 下手动收取使用现有 Mock adapter；已有音乐动作 Mock 测试菜单仍仅作开发预演。普通 URL 的 Together 收取必须选中有 Key 的真实伙伴，直接复用该联系人配置，不创建额外配置或虚构联系人。

## 验证

启动静态服务器，然后运行：

```sh
python3 -m http.server 8774 --bind 127.0.0.1
IB_TEST_BASE_URL=http://localhost:8774 python3 tests/test_reply_rhythm.py
```

测试在网络层拦截真实 provider transport，覆盖发送不请求、批次快照、新一轮隔离、首条前/后停止、失败重试、丢失本地提示后的恢复、超过 history 上限的批次、friend/thread/群聊、流式请求、结构化降级、Together 正式请求及歌曲上下文、模式/伙伴切换、独立消息保存、音乐持续播放和 reduced-motion。真机仍需验收 Safari 的键盘、触控和真实端点可用性。
