# 晏景音乐参与层 v1

本轮使用已有 AI adapter 的静态 Mock，不调用真实 AI。Music 和 Together 共用原生 Audio、队列、歌词及收藏数据。

## 动作契约

```js
{
  id: '动作唯一标识', // 缺省时生成
  type: 'like_song',
  actor: 'yanjing', // mingyue | yanjing，必填
  track: { recordId: '已有曲库记录 ID', title: '歌名', artist: '歌手', reason: '可选推荐理由' },
  playlist: { id: '已有歌单 ID', name: '新建或复用的歌单名称' },
  inviteId: '要回应的邀请 ID'
}
```

字段按动作选择。`play_track` 接受已有记录 ID 或歌名；`recommend_song` 必须带歌名、歌手；加入歌单需要 ID 或名称；接受/拒绝需要邀请 ID。支持 `like_song`、`unlike_song`、`next_track`、`previous_track`、`play_track`、`recommend_song`、`invite_listen_together`、`accept_listen_together`、`decline_listen_together`、`add_to_playlist`。

Adapter 校验结构化 `actions`，消息文字仅负责显示。重新渲染、刷新历史消息不会重新执行动作。音乐动作执行器通过现有入口执行；下一首/上一首复用原生按钮（含现有播放模式），指定已有歌曲复用 `_pwPlayIdx`。推荐被用户点击后，通过 `onlineMusicSearch` 查找，再使用与公共搜歌按钮同一个 `playPublicTrack` 流程；没有另外的歌曲 API 或播放器。

## 本地数据

- 收藏仍用 `localStorage.ib_music_library_v1`，内容升级至 `version: 2`。`actorLikes.mingyue` 和 `actorLikes.yanjing` 分别保存歌曲 key。旧 `liked` 全部迁入明月喜欢，并继续作为明月喜欢的兼容镜像；原 `tracks` 和 `playlists` 保留。`我们都喜欢 = mingyue.includes(key) && yanjing.includes(key)`，不存第三份数据。
- 歌单沿用原 `playlists` 与 `trackKeys`，相同歌曲去重。
- 邀请用 `localStorage.ib_music_participation_v1`：`invitations[id]` 保存发起人、会话、伙伴、pending/accepted/declined 状态与时间。`lastInviteAt` 保存晏景上次主动邀请时间，跨聊天/Together 共用 5 分钟冷却。刷新不会绕过冷却；接受/拒绝校验同一会话、对方角色和未处理状态。
- 普通聊天消息和卡片结果随原 `chatMessages` IndexedDB 保存。Together 对话仍沿用原房间会话状态。

## 验收入口

普通聊天：晏景会话 → 右上角会话菜单 → **邀请一起听**。

仅 `?ib-ai-mock=1` 显示开发测试入口：晏景会话菜单 → **音乐参与 Mock**；Together 更多 → **Mock 测试**。提供喜欢、取消喜欢、下一首、上一首、播放、加入歌单、推荐、主动邀请、普通聊天不邀请、接受、拒绝、loading、error 等确定性场景。不会随机自动切歌。

loading 场景保持等待，选择另一场景或离开会话/房间后取消。推荐搜歌/播放失败保留消息，卡片显示轻量失败提示并可重试。

## 自动化回归

使用 Python Playwright 和 Chromium，静态 HTTP 服务即可，不需要 AI 或音乐平台凭据。公共音乐请求被测试拦截为固定歌曲/音频/歌词。

```sh
# 仓库根目录，终端一
python -m http.server 8770
# 终端二（已安装 playwright 和 /usr/bin/chromium）
python tests/test_music_participation.py
```

`IB_TEST_BASE_URL` 可指定已有 HTTP 服务。测试覆盖旧收藏升级、双人喜欢、歌单去重、原播放器/队列控制、普通聊天推荐卡/邀请卡、推荐搜歌播放与失败降级、冷却、loading/error/接受/拒绝、刷新持久化以及无开发参数时隐藏 Mock。iPhone Safari 的点击播放权限、真实平台歌曲可用性、后台播放和小屏卡片仍需真机验收。
