/**
 * Client half of the DSH Notebook bundle.
 *
 *  - `sidebar.panellist` + `main`: notebook browser.
 *  - `conversation.chat.text-interaction`: right-click selected text.
 *  - `conversation.chat.assistant-actions`: save a whole reply.
 *  - `shell.overlay`: confirmations with view/undo actions.
 *
 * Editing autosaves; deletes go to a trash with undo; notes render Markdown;
 * images support paste, drop, file picker, URL import, captions, and a viewer.
 */
window.__ModuleLoader__.load({
  id: '@hjeremy/dshnotebook',
  factory (require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const NS = 'dshnotebook'
    const API = '/plugin/dshnotebook/api'
    const IMAGES = '/plugin/dshnotebook/images'
    const EXPORT = '/plugin/dshnotebook/export'
    const API_VERSION = 3
    const TOAST_MS = 5500
    const MAX_IMAGES = 20
    const MAX_IMAGE_BYTES = 8 * 1024 * 1024
    const AUTOSAVE_MS = 900
    const MAX_IMPORT_BYTES = 32 * 1024 * 1024
    const SORT_KEY = 'dshnotebook.sort'

    const zh = {
      'panel.label': '笔记本',
      'panel.title': '笔记本',
      'panel.intro': '在对话里选中一段回复后右键，即可收进笔记本；笔记支持 Markdown 阅读、直接编辑和粘贴图片。',
      'panel.new': '新建笔记本',
      'panel.loading': '正在读取笔记本…',
      'panel.retry': '重试',
      'panel.empty': '还没有笔记本',
      'panel.emptyHint': '在对话里选中一段回复后右键，即可把内容写成第一条笔记。',
      'panel.detailEmpty': '从左侧选择一个笔记本',
      'panel.entryCount': '{count} 条笔记',
      'panel.createdAt': '创建于 {date}',
      'panel.export': '导出 Markdown',
      'panel.exportArchive': '导出 ZIP（含图片）',
      'panel.delete': '删除笔记本',
      'panel.entriesEmpty': '这个笔记本还没有内容。可以新建笔记，或在对话中选中内容右键写入。',
      'panel.newTitle': '新建笔记本',
      'panel.renameTitle': '重命名笔记本',
      'panel.rename': '重命名',
      'panel.nameLabel': '笔记本名称',
      'panel.namePlaceholder': '例如：工作区-会话主题',
      'panel.defaultName': '未命名笔记本',
      'panel.create': '创建',
      'panel.cancel': '取消',
      'panel.deleteTitle': '删除笔记本',
      'panel.deleteBody': '《{name}》及其 {count} 条笔记会移入回收站，可在 30 天内恢复。',
      'panel.deleteConfirm': '删除',
      'panel.deleting': '删除中…',
      'panel.newNote': '新建笔记',
      'panel.finish': '完成',
      'panel.cancelEdit': '取消编辑',
      'panel.saving': '保存中…',
      'panel.saved': '已保存',
      'panel.pendingSave': '待保存',
      'panel.saveFailed': '保存失败',
      'panel.editNote': '编辑笔记',
      'panel.deleteNote': '删除笔记',
      'panel.addImage': '添加图片',
      'panel.imageUrl': '从链接',
      'panel.removeImage': '移除图片',
      'panel.pasteHint': '可直接粘贴图片，或把图片拖到这里',
      'panel.uploading': '图片上传中…',
      'panel.notePlaceholder': '写下内容，支持 Markdown，或粘贴一张截图…',
      'panel.noteTextLabel': '笔记内容',
      'panel.emptyNote': '空笔记',
      'panel.openSession': '打开来源会话',
      'panel.searchPlaceholder': '搜索全部笔记',
      'panel.clearSearch': '清空搜索',
      'panel.noMatches': '没有匹配的笔记本',
      'panel.searchEmpty': '没有匹配的笔记',
      'panel.searchCount': '{count} 条匹配',
      'panel.searchHint': '点击结果跳转到笔记',
      'panel.sort': '排序',
      'sort.updated': '按更新时间',
      'sort.created': '按创建时间',
      'sort.name': '按名称',
      'panel.more': '更多操作',
      'panel.pin': '置顶',
      'panel.unpin': '取消置顶',
      'panel.backup': '备份此笔记本',
      'panel.backupAll': '备份全部数据',
      'panel.import': '导入文件',
      'panel.importing': '导入中…',
      'panel.trash': '回收站',
      'panel.trashTitle': '回收站',
      'panel.trashEmpty': '回收站是空的',
      'panel.trashRestore': '恢复',
      'panel.trashPurge': '彻底删除',
      'panel.trashEmptyAll': '清空回收站',
      'panel.trashHint': '删除的内容保留 30 天，恢复后回到原笔记本。',
      'panel.merge': '合并到…',
      'panel.mergeTitle': '合并到另一个笔记本',
      'panel.mergeHint': '当前笔记本的全部笔记会移动到目标笔记本，当前笔记本移入回收站。',
      'panel.move': '移动到…',
      'panel.moveTitle': '移动笔记',
      'panel.pickTarget': '选择目标笔记本',
      'panel.pickEmpty': '没有其他笔记本可选',
      'panel.select': '选择',
      'panel.cancelSelection': '取消选择',
      'panel.selectAll': '全选',
      'panel.selectNone': '取消全选',
      'panel.selectedCount': '已选 {count} 条',
      'panel.deleteSelected': '删除所选',
      'panel.exportSelected': '导出所选',
      'panel.moveSelected': '移动所选',
      'panel.tagsLabel': '标签',
      'panel.tagsPlaceholder': '用逗号分隔，例如：工作, 重要',
      'panel.tagAll': '全部标签',
      'panel.workspaceAll': '全部来源工作区',
      'panel.sessionAll': '全部来源会话',
      'panel.imageUrlTitle': '从图片链接添加',
      'panel.imageUrlPlaceholder': 'https://example.com/screenshot.png',
      'panel.imageUrlFetch': '获取图片',
      'panel.fetchingImage': '正在获取图片…',
      'panel.imageUrlHint': '支持 http/https；内网地址会被拒绝。',
      'panel.imageCaptionPlaceholder': '图片说明（可选）',
      'panel.ocr': '识别文字',
      'panel.ocrBusy': '识别中…',
      'panel.ocrEmpty': '没有识别到文字。',
      'panel.viewImage': '查看图片',
      'panel.zoomIn': '放大',
      'panel.zoomOut': '缩小',
      'panel.resetZoom': '复位',
      'panel.close': '关闭',
      'panel.versionMismatch': '插件版本不匹配：Host v{host} / 客户端 v3。请重启应用后重试，编辑功能已暂时禁用。',
      'panel.imported': '已导入：{names}',
      'panel.backupDone': '备份已开始下载',
      'panel.mergeDone': '已合并到《{name}》',
      'panel.moved': '已移动 {count} 条笔记',
      'panel.restored': '已恢复《{name}》',
      'panel.deletedAt': '删除于 {date}',
      'panel.editedAt': '编辑于 {date}',
      'surface.title': '笔记本操作',
      'surface.selected': '已选 {count} 字',
      'surface.write': '写入笔记本',
      'surface.create': '新建笔记本',
      'surface.pickTitle': '选择笔记本',
      'surface.back': '返回',
      'surface.emptyHint': '新建一个笔记本，把这段内容放进去。',
      'surface.newNotebook': '新建笔记本',
      'surface.createTitle': '新建并写入',
      'surface.createHint': '这段内容会成为新笔记本的第一条笔记。',
      'surface.nameLabel': '笔记本名称',
      'surface.namePlaceholder': '输入笔记本名称',
      'surface.saving': '写入中…',
      'surface.createAndWrite': '创建并写入',
      'msg.title': '存入笔记本',
      'msg.hint': '把这条完整回复写入笔记本。',
      'msg.pickTitle': '选择笔记本',
      'msg.createTitle': '新建并写入',
      'msg.createAndWrite': '创建并写入',
      'msg.nameLabel': '笔记本名称',
      'msg.write': '写入',
      'msg.emptyHint': '这条回复没有可保存的文本。',
      'toast.written': '已写入《{name}》',
      'toast.created': '已新建《{name}》并写入',
      'toast.createdEmpty': '已新建《{name}》',
      'toast.deleted': '已删除《{name}》',
      'toast.deletedNote': '已删除笔记',
      'toast.deletedNotes': '已删除 {count} 条笔记',
      'toast.renamed': '已重命名为《{name}》',
      'toast.exported': '已导出《{name}》',
      'toast.imported': '已导入《{name}》',
      'toast.restored': '已恢复《{name}》',
      'toast.view': '查看',
      'toast.undo': '撤销',
      'toast.dismiss': '关闭提示',
      'error.name': '请输入笔记本名称。',
      'error.notFound': '这个笔记本不存在，可能已被删除。',
      'error.entryNotFound': '这条笔记不存在，可能已被删除。',
      'error.limit': '已达到数量上限，请先删除一些内容。',
      'error.text': '这段内容无法保存（为空或过长）。',
      'error.offline': '无法连接笔记本存储，请稍后重试。',
      'error.generic': '操作失败，请重试。',
      'error.imageFormat': '仅支持 PNG、JPEG、WebP、GIF 图片。',
      'error.imageSize': '图片超过 8 MB 上限。',
      'error.imageCount': '一条笔记最多 20 张图片。',
      'error.imageMissing': '图片丢失了，请重新粘贴。',
      'error.version': '插件版本不一致，请重启应用后再试。',
      'error.import': '导入失败，请检查文件格式。',
      'error.notebookMissing': '目标笔记本已不存在，请先恢复它。',
      'error.trash': '回收站项目已不存在。',
      'error.url': '请输入有效的 http 或 https 图片链接。',
      'error.fetchImage': '图片下载失败。',
      'error.save': '保存失败，请检查网络后重试。',
      'error.ocrUnavailable': 'OCR 不可用（仅 macOS，且需要 Swift 工具链）。',
      'error.ocrFailed': '文字识别失败。',
      'time.justNow': '刚刚',
      'time.minutes': '{count} 分钟前',
      'time.hours': '{count} 小时前',
      'time.days': '{count} 天前',
    }

    const en = {
      'panel.label': 'Notebooks',
      'panel.title': 'Notebooks',
      'panel.intro': 'Select part of a reply and right-click to keep it. Notes render Markdown, are editable, and accept pasted images.',
      'panel.new': 'New notebook',
      'panel.loading': 'Loading notebooks…',
      'panel.retry': 'Retry',
      'panel.empty': 'No notebooks yet',
      'panel.emptyHint': 'Select part of a reply in the conversation, right-click it, and save it as the first note.',
      'panel.detailEmpty': 'Choose a notebook on the left',
      'panel.entryCount': '{count} notes',
      'panel.createdAt': 'Created {date}',
      'panel.export': 'Export Markdown',
      'panel.exportArchive': 'Export ZIP (with images)',
      'panel.delete': 'Delete notebook',
      'panel.entriesEmpty': 'This notebook is empty. Create a note, or select conversation text and right-click to save it here.',
      'panel.newTitle': 'New notebook',
      'panel.renameTitle': 'Rename notebook',
      'panel.rename': 'Rename',
      'panel.nameLabel': 'Notebook name',
      'panel.namePlaceholder': 'e.g. Workspace - session topic',
      'panel.defaultName': 'Untitled notebook',
      'panel.create': 'Create',
      'panel.cancel': 'Cancel',
      'panel.deleteTitle': 'Delete notebook',
      'panel.deleteBody': '“{name}” and its {count} notes move to the trash and can be restored for 30 days.',
      'panel.deleteConfirm': 'Delete',
      'panel.deleting': 'Deleting…',
      'panel.newNote': 'New note',
      'panel.finish': 'Done',
      'panel.cancelEdit': 'Discard',
      'panel.saving': 'Saving…',
      'panel.saved': 'Saved',
      'panel.pendingSave': 'Unsaved',
      'panel.saveFailed': 'Save failed',
      'panel.editNote': 'Edit note',
      'panel.deleteNote': 'Delete note',
      'panel.addImage': 'Add image',
      'panel.imageUrl': 'From URL',
      'panel.removeImage': 'Remove image',
      'panel.pasteHint': 'Paste an image here, or drop one in',
      'panel.uploading': 'Uploading image…',
      'panel.notePlaceholder': 'Write something with Markdown, or paste a screenshot…',
      'panel.noteTextLabel': 'Note text',
      'panel.emptyNote': 'Empty note',
      'panel.openSession': 'Open source session',
      'panel.searchPlaceholder': 'Search all notes',
      'panel.clearSearch': 'Clear search',
      'panel.noMatches': 'No matching notebooks',
      'panel.searchEmpty': 'No matching notes',
      'panel.searchCount': '{count} matches',
      'panel.searchHint': 'Click a result to jump to the note',
      'panel.sort': 'Sort',
      'sort.updated': 'Last updated',
      'sort.created': 'Newest created',
      'sort.name': 'Name',
      'panel.more': 'More actions',
      'panel.pin': 'Pin',
      'panel.unpin': 'Unpin',
      'panel.backup': 'Back up this notebook',
      'panel.backupAll': 'Back up everything',
      'panel.import': 'Import a file',
      'panel.importing': 'Importing…',
      'panel.trash': 'Trash',
      'panel.trashTitle': 'Trash',
      'panel.trashEmpty': 'The trash is empty',
      'panel.trashRestore': 'Restore',
      'panel.trashPurge': 'Delete forever',
      'panel.trashEmptyAll': 'Empty trash',
      'panel.trashHint': 'Deleted items stay for 30 days and return to their notebook when restored.',
      'panel.merge': 'Merge into…',
      'panel.mergeTitle': 'Merge into another notebook',
      'panel.mergeHint': 'All notes move to the target notebook and this notebook goes to the trash.',
      'panel.move': 'Move to…',
      'panel.moveTitle': 'Move notes',
      'panel.pickTarget': 'Choose a target notebook',
      'panel.pickEmpty': 'No other notebook to choose',
      'panel.select': 'Select',
      'panel.cancelSelection': 'Cancel',
      'panel.selectAll': 'Select all',
      'panel.selectNone': 'Select none',
      'panel.selectedCount': '{count} selected',
      'panel.deleteSelected': 'Delete selected',
      'panel.exportSelected': 'Export selected',
      'panel.moveSelected': 'Move selected',
      'panel.tagsLabel': 'Tags',
      'panel.tagsPlaceholder': 'Comma separated, e.g. work, important',
      'panel.tagAll': 'All tags',
      'panel.workspaceAll': 'All workspaces',
      'panel.sessionAll': 'All source sessions',
      'panel.imageUrlTitle': 'Add from image URL',
      'panel.imageUrlPlaceholder': 'https://example.com/screenshot.png',
      'panel.imageUrlFetch': 'Fetch image',
      'panel.fetchingImage': 'Fetching image…',
      'panel.imageUrlHint': 'http/https only; private network addresses are rejected.',
      'panel.imageCaptionPlaceholder': 'Image caption (optional)',
      'panel.ocr': 'Extract text',
      'panel.ocrBusy': 'Recognizing…',
      'panel.ocrEmpty': 'No text was recognized.',
      'panel.viewImage': 'View image',
      'panel.zoomIn': 'Zoom in',
      'panel.zoomOut': 'Zoom out',
      'panel.resetZoom': 'Reset zoom',
      'panel.close': 'Close',
      'panel.versionMismatch': 'Version mismatch: Host v{host} / client v3. Restart the app; editing is disabled until then.',
      'panel.imported': 'Imported: {names}',
      'panel.backupDone': 'Backup download started',
      'panel.mergeDone': 'Merged into “{name}”',
      'panel.moved': 'Moved {count} notes',
      'panel.restored': 'Restored “{name}”',
      'panel.deletedAt': 'Deleted {date}',
      'panel.editedAt': 'Edited {date}',
      'surface.title': 'Notebook actions',
      'surface.selected': '{count} characters selected',
      'surface.write': 'Add to notebook',
      'surface.create': 'New notebook',
      'surface.pickTitle': 'Choose a notebook',
      'surface.back': 'Back',
      'surface.emptyHint': 'Create one to keep this selection.',
      'surface.newNotebook': 'New notebook',
      'surface.createTitle': 'Create and save',
      'surface.createHint': 'The selection becomes the first note of the new notebook.',
      'surface.nameLabel': 'Notebook name',
      'surface.namePlaceholder': 'Notebook name',
      'surface.saving': 'Saving…',
      'surface.createAndWrite': 'Create and save',
      'msg.title': 'Save to notebook',
      'msg.hint': 'Save this whole reply to a notebook.',
      'msg.pickTitle': 'Choose a notebook',
      'msg.createTitle': 'Create and save',
      'msg.createAndWrite': 'Create and save',
      'msg.nameLabel': 'Notebook name',
      'msg.write': 'Save',
      'msg.emptyHint': 'This reply has no text to save.',
      'toast.written': 'Saved to “{name}”',
      'toast.created': 'Created “{name}” and saved',
      'toast.createdEmpty': 'Created “{name}”',
      'toast.deleted': 'Deleted “{name}”',
      'toast.deletedNote': 'Note deleted',
      'toast.deletedNotes': 'Deleted {count} notes',
      'toast.renamed': 'Renamed to “{name}”',
      'toast.exported': 'Exported “{name}”',
      'toast.imported': 'Imported “{name}”',
      'toast.restored': 'Restored “{name}”',
      'toast.view': 'View',
      'toast.undo': 'Undo',
      'toast.dismiss': 'Dismiss',
      'error.name': 'Enter a notebook name.',
      'error.notFound': 'That notebook no longer exists.',
      'error.entryNotFound': 'That note no longer exists.',
      'error.limit': 'The limit has been reached; remove something first.',
      'error.text': 'This text cannot be saved (empty or too long).',
      'error.offline': 'The notebook store is unreachable. Try again.',
      'error.generic': 'The action failed. Try again.',
      'error.imageFormat': 'Only PNG, JPEG, WebP, and GIF images are supported.',
      'error.imageSize': 'The image exceeds the 8 MB limit.',
      'error.imageCount': 'A note can hold at most 20 images.',
      'error.imageMissing': 'The image is missing; paste it again.',
      'error.version': 'Plugin versions differ; restart the app and try again.',
      'error.import': 'Import failed; check the file format.',
      'error.notebookMissing': 'The target notebook is gone; restore it first.',
      'error.trash': 'That trash item no longer exists.',
      'error.url': 'Enter a valid http or https image URL.',
      'error.fetchImage': 'The image download failed.',
      'error.save': 'Saving failed; check the connection and retry.',
      'error.ocrUnavailable': 'OCR is unavailable (macOS with the Swift toolchain only).',
      'error.ocrFailed': 'Text recognition failed.',
      'time.justNow': 'just now',
      'time.minutes': '{count} min ago',
      'time.hours': '{count} h ago',
      'time.days': '{count} d ago',
    }

    const CSS = `
.dsn-page{box-sizing:border-box;width:100%;min-width:0;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.55}
.dsn-head{box-sizing:border-box;flex:none;width:100%;max-width:1060px;margin:0 auto;padding:26px clamp(24px,4vw,48px) 16px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
[data-platform=darwin] .dsn-head{padding-top:calc(26px + var(--dsh-frame-top-clearance,0px))}
.dsn-headTitle{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dsn-headIntro{margin:4px 0 0;max-width:64ch;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dsn-headActions{flex:none;display:flex;align-items:center;gap:8px}
.dsn-banner{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dsn-bodyWrap{flex:1;min-height:0;display:flex;width:100%;overflow:hidden}
.dsn-body{box-sizing:border-box;width:100%;max-width:1060px;margin:0 auto;min-height:0;display:flex;border-top:.5px solid var(--dsw-alias-border-l1);padding:0 clamp(24px,4vw,48px)}
.dsn-side{box-sizing:border-box;flex:0 0 clamp(240px,30%,340px);min-width:0;overflow:auto;padding:12px 16px 28px 0}
.dsn-detail{box-sizing:border-box;flex:1;min-width:0;overflow:auto;border-left:.5px solid var(--dsw-alias-border-l1);padding:18px 0 40px clamp(20px,2.6vw,32px)}
.dsn-sideTools{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.dsn-sideRow{display:flex;align-items:center;gap:8px;min-width:0}
.dsn-search{position:relative}
.dsn-searchInput{box-sizing:border-box;width:100%;height:32px;padding:0 30px 0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:20px}
.dsn-searchInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.dsn-searchClear{position:absolute;right:4px;top:4px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsn-searchClear:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-select{box-sizing:border-box;height:30px;max-width:100%;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:20px}
.dsn-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dsn-nb{box-sizing:border-box;width:100%;display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsn-nb:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dsn-nbActive,.dsn-nbActive:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)}
.dsn-nb>svg{flex:none;margin-top:3px;color:var(--dsw-alias-label-secondary)}
.dsn-nbActive>svg{color:var(--dsw-alias-label-primary)}
.dsn-nbText{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dsn-nbName{font-size:13.5px;line-height:20px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-nbMeta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-pinMark{flex:none;margin-top:4px;color:var(--dsw-alias-label-secondary)}
.dsn-result{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsn-result:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dsn-resultTop{display:flex;align-items:baseline;gap:6px;min-width:0}
.dsn-resultName{flex:1;min-width:0;font-size:12px;line-height:18px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-resultTime{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dsn-resultSnippet{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsn-detailHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.dsn-detailTitleWrap{min-width:0}
.dsn-detailTitleRow{display:flex;align-items:center;gap:2px;min-width:0}
.dsn-detailTitle{margin:0;font-size:18px;font-weight:500;line-height:26px;overflow-wrap:anywhere}
.dsn-detailMeta{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsn-detailActions{flex:none;display:flex;gap:8px;flex-wrap:wrap}
.dsn-detailEmpty{height:100%;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}
.dsn-detailEmpty>p{margin:0;font-size:13px;line-height:20px}
.dsn-filters{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 14px}
.dsn-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:18px;cursor:pointer;white-space:nowrap}
.dsn-chip:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dsn-chipActive{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-entries{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.dsn-entry{position:relative;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:10px 14px 12px}
.dsn-entry[data-focused="true"]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 25%,transparent)}
.dsn-entry[data-selected="true"]{border-color:var(--dsw-alias-brand-primary)}
.dsn-entryHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
.dsn-entryTime{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dsn-entryActions{display:flex;align-items:center;gap:2px;flex:none}
.dsn-entryAction{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsn-entryAction:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-entryAction.dsn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary)}
.dsn-selectBox{width:16px;height:16px;flex:none;margin:3px 6px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsn-emptyNote{margin:2px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-style:italic}
.dsn-entryMeta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsn-source{padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;max-width:42ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-source:hover{color:var(--dsw-alias-label-primary)}
.dsn-sourceStatic{max-width:42ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-metaDot{color:var(--dsw-alias-label-secondary)}
.dsn-noteTags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.dsn-noteTag{height:20px;padding:0 7px;border:0;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:20px;cursor:pointer}
.dsn-noteTag:hover{color:var(--dsw-alias-label-primary)}
.dsn-gallery{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.dsn-thumb{display:block;box-sizing:border-box;max-width:100%;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);padding:0;cursor:zoom-in}
.dsn-thumb img{display:block;max-width:220px;max-height:160px;width:auto;height:auto;object-fit:contain}
.dsn-figure{margin:0;display:flex;flex-direction:column;gap:4px;max-width:220px}
.dsn-caption{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;overflow-wrap:anywhere}
.dsn-thumbWrap{position:relative;display:flex;flex-direction:column;gap:4px;max-width:220px}
.dsn-thumbBox{position:relative;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.dsn-thumbBox img{display:block;max-width:220px;max-height:160px;width:auto;height:auto;object-fit:contain}
.dsn-thumbRemove{position:absolute;top:4px;right:4px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 90%,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1;cursor:pointer}
.dsn-thumbRemove:hover{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent)}
.dsn-captionInput{box-sizing:border-box;width:100%;height:26px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px}
.dsn-captionInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsn-editor{display:flex;flex-direction:column;gap:8px}
.dsn-textarea{box-sizing:border-box;width:100%;min-height:140px;max-height:420px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13.5px;line-height:22px;resize:vertical;field-sizing:content}
.dsn-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.dsn-tagsInput{box-sizing:border-box;width:100%;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.dsn-tagsInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsn-editorBar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dsn-editorHint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsn-editorStatus{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:18px;margin-left:auto;margin-right:8px;font-variant-numeric:tabular-nums}
.dsn-editorStatus[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.dsn-editorActions{display:flex;gap:8px}
.dsn-selectionBar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.dsn-selectionCount{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);margin-right:auto}
.dsn-hint{margin:8px 2px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dsn-empty{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:20px 6px;color:var(--dsw-alias-label-secondary)}
.dsn-emptyTitle{margin:6px 0 0;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsn-emptyHint{margin:0;font-size:12px;line-height:20px}
.dsn-error{margin:8px 2px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.dsn-error p,.dsn-errorText{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.dsn-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}
.dsn-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dsn-btn:disabled{opacity:.55;cursor:default}
.dsn-btn>svg{flex:none}
.dsn-btnPrimary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.dsn-btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,#000)}
.dsn-btnDanger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
.dsn-btnDanger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.dsn-btnSolid.dsn-btnDanger{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:#fff}
.dsn-btnSolid.dsn-btnDanger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 88%,#000)}
.dsn-btnSmall{height:26px;padding:0 8px;font-size:12px}
.dsn-btnBlock{width:100%}
.dsn-iconBtn{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsn-iconBtn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-menu{position:relative;flex:none}
.dsn-menuList{position:absolute;right:0;top:calc(100% + 4px);z-index:1200;min-width:190px;padding:4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgba(0,0,0,.22);display:flex;flex-direction:column;gap:1px}
.dsn-menuEntry{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer;white-space:nowrap}
.dsn-menuEntry:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.dsn-menuEntry.dsn-danger{color:var(--dsw-alias-state-error-primary)}
.dsn-menuEntry.dsn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.dsn-backdrop{position:fixed;inset:0;z-index:1400;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,#000 34%,transparent)}
.dsn-modal{box-sizing:border-box;width:min(460px,100%);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;padding:18px 18px 16px;border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px rgba(0,0,0,.28)}
.dsn-modalWide{width:min(620px,100%)}
.dsn-modalHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.dsn-modalTitle{margin:0;font-size:16px;font-weight:500;line-height:24px}
.dsn-modalBody{display:flex;flex-direction:column;gap:10px;min-height:0;overflow:auto}
.dsn-modalText{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dsn-modalActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap}
.dsn-field{display:flex;flex-direction:column;gap:6px}
.dsn-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dsn-input{box-sizing:border-box;width:100%;height:36px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.dsn-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.dsn-pickList{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}
.dsn-pickItem{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.dsn-pickItem:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.dsn-pickName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-pickMeta{flex:none;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dsn-trashRow{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dsn-trashRow:last-child{border-bottom:0}
.dsn-trashMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dsn-trashTitle{font-size:13px;line-height:19px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-trashMeta{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-trashActions{flex:none;display:flex;gap:4px}
.dsn-surface{box-sizing:border-box;width:300px;max-width:100%;max-height:100%;display:flex;flex-direction:column;gap:2px;padding:6px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 16px 40px rgba(0,0,0,.24);overflow:auto}
.dsn-preview{margin:0 0 4px;padding:6px 8px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsn-menuItem{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.dsn-menuItem:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.dsn-menuItem>svg{flex:none;color:var(--dsw-alias-label-secondary)}
.dsn-surfaceHead{display:flex;align-items:center;gap:4px;padding:2px 2px 6px}
.dsn-surfaceTitle{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-weight:500}
.dsn-pickCount{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.dsn-pickNew{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;padding:8px 10px;margin-top:2px;border:0;border-top:.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:20px;text-align:left;cursor:pointer;border-radius:0 0 8px 8px}
.dsn-pickNew:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-createForm{display:flex;flex-direction:column;gap:8px;padding:2px}
.dsn-viewer{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,#000 60%,transparent)}
.dsn-viewerPanel{box-sizing:border-box;max-width:min(1000px,100%);max-height:100%;display:flex;flex-direction:column;gap:8px}
.dsn-viewerHead{display:flex;align-items:center;gap:10px;color:#fff;font-size:13px;line-height:20px}
.dsn-viewerCaption{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-viewerBody{min-height:0;overflow:auto;display:flex;justify-content:center;align-items:flex-start}
.dsn-viewerBody img{display:block;transform-origin:top center;background:#fff}
.dsn-viewerBar{display:flex;justify-content:center;align-items:center;gap:8px}
.dsn-viewerBtn{height:28px;min-width:32px;padding:0 10px;border:.5px solid rgba(255,255,255,.35);border-radius:8px;background:rgba(0,0,0,.25);color:#fff;font:inherit;font-size:12px;cursor:pointer}
.dsn-viewerBtn:hover{background:rgba(0,0,0,.45)}
.dsn-md{font-size:13.5px;line-height:22px;overflow-wrap:anywhere;max-height:520px;overflow:auto}
.dsn-md>*:first-child{margin-top:0}
.dsn-md>*:last-child{margin-bottom:0}
.dsn-md p{margin:0 0 8px;white-space:pre-wrap}
.dsn-md h3,.dsn-md h4,.dsn-md h5,.dsn-md h6{margin:12px 0 6px;font-weight:600;line-height:1.4}
.dsn-md h3{font-size:17px}
.dsn-md h4{font-size:15px}
.dsn-md h5,.dsn-md h6{font-size:14px}
.dsn-md ul,.dsn-md ol{margin:0 0 8px;padding-left:22px}
.dsn-md li{margin:2px 0;white-space:pre-wrap}
.dsn-md blockquote{margin:0 0 8px;padding:2px 0 2px 10px;border-left:2px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:pre-wrap}
.dsn-md pre{margin:0 0 8px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:auto;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px}
.dsn-md code{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px}
.dsn-md pre code{background:transparent;padding:0}
.dsn-md a{color:var(--dsw-alias-brand-primary);text-decoration:underline;text-underline-offset:2px}
.dsn-md img{max-width:100%;border-radius:8px}
.dsn-md hr{border:0;border-top:.5px solid var(--dsw-alias-border-l1);margin:12px 0}
.dsn-mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);color:inherit;border-radius:3px;padding:0 1px}
.dsn-msgAction{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:5px;background:transparent;color:inherit;cursor:pointer;opacity:.75}
.dsn-msgAction:hover{opacity:1;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
.dsn-toastLayer{position:fixed;left:50%;top:96px;transform:translateX(-50%);z-index:1300;display:flex;justify-content:center;max-width:calc(100vw - 32px);pointer-events:none}
.dsn-toast{display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 32px));padding:8px 8px 8px 14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 12px 32px rgba(0,0,0,.22);font-size:13px;line-height:20px;pointer-events:auto}
.dsn-toastText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsn-toastAction{flex:none;padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:13px;cursor:pointer}
.dsn-toastAction:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.dsn-toastClose{flex:none;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:16px;line-height:1;cursor:pointer}
.dsn-toastClose:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dsn-page :focus-visible,.dsn-surface :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsn-page .dsn-input:focus-visible,.dsn-page .dsn-textarea:focus-visible,.dsn-page .dsn-tagsInput:focus-visible,.dsn-page .dsn-captionInput:focus-visible,.dsn-surface .dsn-input:focus-visible{outline:none}
@media (width<=760px){
.dsn-head{padding:20px clamp(20px,4vw,32px) 14px}
.dsn-body{padding:0 clamp(20px,4vw,32px);flex-direction:column}
.dsn-side{flex:none;max-height:38%;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dsn-detail{border-left:0;padding:16px 0 32px}
}
`

    function insertStyles () {
      if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
        return styles.insert(CSS)
      }
      const element = document.createElement('style')
      element.setAttribute('data-dshnotebook', '')
      element.textContent = CSS
      document.head.appendChild(element)
      return () => element.remove()
    }

    /* --------------------------------- icons --------------------------------- */

    function icon (paths, size) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size || 14,
        height: size || 14,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { display: 'block' },
      }, paths.map((path, index) => h('path', { key: index, d: path })))
    }

    const IconPlus = () => icon(['M12 5v14', 'M5 12h14'])
    const IconBack = () => icon(['M15 5l-7 7 7 7'])
    const IconClose = () => icon(['M6 6l12 12', 'M18 6L6 18'])
    const IconDownload = () => icon(['M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M5 19h14'])
    const IconTrash = () => icon(['M4.5 7h15', 'M10 7V4.8h4V7', 'M7 7l.8 12.2h8.4L17 7', 'M10.5 10.5v5.5', 'M13.5 10.5v5.5'])
    const IconEdit = () => icon(['M4 20h4l10.4-10.4a2.1 2.1 0 0 0-3-3L5 17v3Z', 'M13.4 6.6l4 4'])
    const IconMore = () => h('svg', {
      viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': 'true', style: { display: 'block' },
    },
    h('circle', { cx: 12, cy: 5, r: 1.6 }),
    h('circle', { cx: 12, cy: 12, r: 1.6 }),
    h('circle', { cx: 12, cy: 19, r: 1.6 }))
    const IconStar = (props) => h('svg', {
      viewBox: '0 0 24 24', width: props.size || 13, height: props.size || 13,
      fill: props.filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', style: { display: 'block' },
    }, h('path', { d: 'M12 3.6l2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.9Z' }))

    function NotebookGlyph (props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.active ? 1.9 : 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { display: 'block' },
      },
      h('rect', { key: 'a', x: 4.5, y: 3.5, width: 15, height: 17, rx: 2.4 }),
      h('path', { key: 'b', d: 'M9 3.5v17' }),
      h('path', { key: 'c', d: 'M12.5 8h4' }),
      h('path', { key: 'd', d: 'M12.5 12h4' }))
    }

    /* -------------------------------- helpers -------------------------------- */

    function safeFilename (value) {
      const cleaned = String(value || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '_')
        .replace(/[. ]+$/u, '')
        .trim()
        .slice(0, 80)
      return cleaned === '' ? 'notebook' : cleaned
    }

    function sameImages (left, right) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false
      if (left.length !== right.length) return false
      return left.every((image, index) => (
        image && right[index] && image.id === right[index].id &&
        (image.caption || '') === (right[index].caption || '')
      ))
    }

    function parseTags (text) {
      const tags = []
      const seen = new Set()
      for (const raw of String(text || '').split(/[,，]/u)) {
        const tag = raw.trim().slice(0, 40)
        if (tag === '') continue
        const key = tag.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        tags.push(tag)
        if (tags.length >= 20) break
      }
      return tags
    }

    function sameTags (left, right) {
      const a = Array.isArray(left) ? left : []
      const b = Array.isArray(right) ? right : []
      if (a.length !== b.length) return false
      return a.every((tag, index) => String(tag).toLowerCase() === String(b[index]).toLowerCase())
    }

    function imageExt (image) {
      if (image && typeof image.ext === 'string' && image.ext !== '') return image.ext
      if (image && image.mediaType === 'image/jpeg') return 'jpg'
      const part = image && typeof image.mediaType === 'string' ? image.mediaType.split('/')[1] : ''
      return part === 'png' || part === 'jpeg' || part === 'webp' || part === 'gif' ? part : 'png'
    }

    function imageUrl (image) {
      return `${IMAGES}/${image.id}.${imageExt(image)}`
    }

    function snippetOf (text, query, radius) {
      const source = String(text || '').replace(/\s+/gu, ' ').trim()
      if (query === '') return source.slice(0, 120)
      const index = source.toLowerCase().indexOf(query.toLowerCase())
      if (index < 0) return source.slice(0, 120)
      const pad = radius || 50
      const start = Math.max(0, index - pad)
      const end = Math.min(source.length, index + query.length + pad)
      return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`
    }

    function readFileDataUrl (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(reader.error || new Error('read failed'))
        reader.readAsDataURL(file)
      })
    }

    function bufferToBase64 (buffer) {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunk = 0x8000
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk))
      }
      return btoa(binary)
    }

    async function prepareImage (file) {
      if (!file || file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
      let bitmap
      try {
        bitmap = await createImageBitmap(file)
      } catch {
        return file
      }
      try {
        const maxSide = 2000
        const tooLarge = file.size > 1.5 * 1024 * 1024 || Math.max(bitmap.width, bitmap.height) > 2400
        if (!tooLarge) return file
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (context === null) return file
        context.drawImage(bitmap, 0, 0, width, height)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
        if (!blob || blob.size >= file.size) return file
        const name = (file.name || 'image').replace(/\.[^.]+$/u, '') + '.webp'
        return new File([blob], name, { type: 'image/webp' })
      } catch {
        return file
      } finally {
        if (bitmap && typeof bitmap.close === 'function') bitmap.close()
      }
    }

    /* ------------------------------- markdown -------------------------------- */

    // <markdown-parser>
    function parseMarkdown (text) {
      const lines = String(text === undefined || text === null ? '' : text).replace(/\r\n?/gu, '\n').split('\n')
      const blocks = []
      let index = 0
      const blank = (line) => line.trim() === ''
      const isHeading = (line) => /^(#{1,6})\s+/u.test(line)
      const isFence = (line) => /^```/u.test(line)
      const isHr = (line) => /^\s*(---|\*\*\*|___)\s*$/u.test(line)
      const isQuote = (line) => /^\s*>\s?/u.test(line)
      const isItem = (line) => /^\s*([-*+]|\d+[.)])\s+/u.test(line)
      while (index < lines.length) {
        const line = lines[index]
        if (blank(line)) {
          index += 1
          continue
        }
        const fence = /^```(.*)$/u.exec(line)
        if (fence !== null) {
          const lang = fence[1].trim()
          const body = []
          index += 1
          while (index < lines.length && !isFence(lines[index])) {
            body.push(lines[index])
            index += 1
          }
          if (index < lines.length) index += 1
          blocks.push({ type: 'code', lang, text: body.join('\n') })
          continue
        }
        if (isHeading(line)) {
          const heading = /^(#{1,6})\s+(.*)$/u.exec(line)
          blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
          index += 1
          continue
        }
        if (isHr(line)) {
          blocks.push({ type: 'hr' })
          index += 1
          continue
        }
        if (isQuote(line)) {
          const body = []
          while (index < lines.length && isQuote(lines[index])) {
            body.push(lines[index].replace(/^\s*>\s?/u, ''))
            index += 1
          }
          blocks.push({ type: 'quote', text: body.join('\n') })
          continue
        }
        const bullet = /^\s*[-*+]\s+/u.test(line)
        const ordered = /^\s*\d+[.)]\s+/u.test(line)
        if (bullet || ordered) {
          const items = []
          while (index < lines.length) {
            const row = lines[index]
            const matched = ordered ? /^\s*\d+[.)]\s+(.*)$/u.exec(row) : /^\s*[-*+]\s+(.*)$/u.exec(row)
            if (matched === null) break
            items.push(matched[1])
            index += 1
          }
          blocks.push({ type: 'list', ordered, items })
          continue
        }
        const paragraph = []
        while (index < lines.length) {
          const row = lines[index]
          if (blank(row) || isFence(row) || isHeading(row) || isHr(row) || isQuote(row) || isItem(row)) break
          paragraph.push(row)
          index += 1
        }
        if (paragraph.length === 0) {
          paragraph.push(lines[index])
          index += 1
        }
        blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
      }
      return blocks
    }
    // </markdown-parser>

    const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(!\[[^\]\n]*\]\(https?:\/\/[^)\s]+\))|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/gu

    function highlightParts (text, keyBase, query) {
      if (typeof query !== 'string' || query === '') return [text]
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      const split = text.split(new RegExp(`(${escaped})`, 'giu'))
      return split.map((part, index) => (
        index % 2 === 1
          ? h('mark', { key: `${keyBase}-m${index}`, className: 'dsn-mark' }, part)
          : part
      ))
    }

    function inlineNodes (text, keyBase, query) {
      const nodes = []
      // A fresh global regex per call: recursion must not share lastIndex.
      const pattern = new RegExp(INLINE_PATTERN.source, INLINE_PATTERN.flags)
      let last = 0
      let match
      let index = 0
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(...highlightParts(text.slice(last, match.index), `${keyBase}-t${index}`, query))
        const token = match[0]
        const key = `${keyBase}-i${index}`
        if (match[1] !== undefined) {
          nodes.push(h('code', { key }, token.slice(1, -1)))
        } else if (match[2] !== undefined) {
          nodes.push(h('strong', { key }, inlineNodes(token.slice(2, -2), key, query)))
        } else if (match[3] !== undefined) {
          nodes.push(h('strong', { key }, inlineNodes(token.slice(2, -2), key, query)))
        } else if (match[4] !== undefined) {
          nodes.push(h('em', { key }, inlineNodes(token.slice(1, -1), key, query)))
        } else if (match[5] !== undefined) {
          nodes.push(h('em', { key }, inlineNodes(token.slice(1, -1), key, query)))
        } else if (match[6] !== undefined) {
          const image = /^!\[([^\]\n]*)\]\((https?:\/\/[^)\s]+)\)$/u.exec(token)
          if (image !== null) {
            nodes.push(h('img', { key, src: image[2], alt: image[1] }))
          }
        } else if (match[7] !== undefined) {
          const link = /^\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)$/u.exec(token)
          if (link !== null) {
            nodes.push(h('a', {
              key,
              href: link[2],
              target: '_blank',
              rel: 'noreferrer noopener',
            }, inlineNodes(link[1], key, query)))
          }
        }
        index += 1
        last = match.index + token.length
      }
      if (last < text.length) nodes.push(...highlightParts(text.slice(last), `${keyBase}-e`, query))
      return nodes
    }

    function renderMarkdown (text, highlight) {
      const blocks = parseMarkdown(text)
      return h('div', { className: 'dsn-md' }, blocks.map((block, index) => {
        const key = `b${index}`
        if (block.type === 'code') {
          return h('pre', { key }, h('code', null, block.text))
        }
        if (block.type === 'heading') {
          const tag = block.level <= 1 ? 'h3' : block.level === 2 ? 'h4' : block.level === 3 ? 'h5' : 'h6'
          return h(tag, { key }, inlineNodes(block.text, key, highlight))
        }
        if (block.type === 'hr') return h('hr', { key })
        if (block.type === 'quote') {
          return h('blockquote', { key }, inlineNodes(block.text, key, highlight))
        }
        if (block.type === 'list') {
          const tag = block.ordered ? 'ol' : 'ul'
          return h(tag, { key }, block.items.map((item, itemIndex) => h('li', { key: `${key}-${itemIndex}` }, inlineNodes(item, `${key}-${itemIndex}`, highlight))))
        }
        return h('p', { key }, inlineNodes(block.text, key, highlight))
      }))
    }

    /* --------------------------------- store --------------------------------- */

    function createNotebookStore () {
      let snapshot = {
        phase: 'loading',
        notebooks: [],
        trash: [],
        apiVersion: null,
        compatible: false,
        error: null,
        errorCode: '',
        selectedId: null,
      }
      const listeners = new Set()
      let inflight = null
      let writes = 0
      let generation = 0

      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      const commit = (patch) => {
        snapshot = { ...snapshot, ...patch }
        emit()
      }
      const normalizeNotebooks = (value) => (Array.isArray(value) ? value : []).map((notebook) => ({
        ...notebook,
        pinned: notebook.pinned === true,
        entries: Array.isArray(notebook.entries)
          ? notebook.entries.map((entry) => ({
            ...entry,
            images: Array.isArray(entry.images) ? entry.images : [],
            tags: Array.isArray(entry.tags) ? entry.tags : [],
          }))
          : [],
      }))
      const pickSelection = (notebooks, preferred) => {
        const wanted = preferred !== undefined ? preferred : snapshot.selectedId
        if (wanted && notebooks.some((notebook) => notebook.id === wanted)) return wanted
        return notebooks.length > 0 ? notebooks[0].id : null
      }
      const accept = (payload, preferred) => {
        const notebooks = normalizeNotebooks(payload && payload.notebooks)
        const trash = payload && Array.isArray(payload.trash) ? payload.trash : []
        const apiVersion = payload && typeof payload.apiVersion === 'number' ? payload.apiVersion : null
        const wanted = preferred === 'keep'
          ? snapshot.selectedId
          : preferred !== undefined
            ? preferred
            : payload && (payload.notebookId !== undefined ? payload.notebookId : payload.createdId)
        commit({
          phase: 'ready',
          notebooks,
          trash,
          apiVersion,
          compatible: apiVersion === API_VERSION,
          error: null,
          errorCode: '',
          selectedId: pickSelection(notebooks, wanted),
        })
      }
      const readPayload = async (response) => {
        try {
          return await response.json()
        } catch {
          return null
        }
      }
      const failureOf = (payload, status) => {
        const failure = new Error(payload && typeof payload.message === 'string' ? payload.message : `HTTP ${status}`)
        failure.code = payload && typeof payload.code === 'string' ? payload.code : 'generic'
        return failure
      }
      const load = () => {
        if (writes > 0) return Promise.resolve()
        if (inflight !== null) return inflight
        const startedAt = generation
        if (snapshot.phase !== 'ready') commit({ phase: 'loading', error: null, errorCode: '' })
        inflight = (async () => {
          try {
            const response = await fetch(API, { cache: 'no-store', headers: { accept: 'application/json' } })
            const payload = await readPayload(response)
            if (!response.ok || payload === null || payload.ok !== true) throw failureOf(payload, response.status)
            if (generation !== startedAt) return
            accept(payload)
          } catch (error) {
            commit({
              phase: 'error',
              errorCode: error && typeof error.code === 'string' ? error.code : 'offline',
              error: error instanceof Error ? error.message : String(error),
            })
          } finally {
            inflight = null
          }
        })()
        return inflight
      }
      const send = async (body, preferred) => {
        writes += 1
        generation += 1
        try {
          let response
          try {
            response = await fetch(API, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              cache: 'no-store',
            })
          } catch {
            const failure = new Error('offline')
            failure.code = 'offline'
            throw failure
          }
          const payload = await readPayload(response)
          if (!response.ok || payload === null || payload.ok !== true) throw failureOf(payload, response.status)
          accept(payload, preferred)
          return payload
        } finally {
          writes -= 1
        }
      }

      return {
        subscribe (listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot () {
          return snapshot
        },
        load,
        select (notebookId) {
          if (snapshot.selectedId === notebookId) return
          commit({ selectedId: notebookId })
        },
        create (name, text, source) {
          return send({ action: 'create', name, text, source })
        },
        rename (notebookId, name) {
          return send({ action: 'rename', notebookId, name })
        },
        pin (notebookId, pinned) {
          return send({ action: 'pin', notebookId, pinned })
        },
        append (notebookId, text, source, tags) {
          return send({ action: 'append', notebookId, text, source, tags })
        },
        addEntry (notebookId) {
          return send({ action: 'addEntry', notebookId })
        },
        updateEntry (notebookId, entryId, text, images, tags) {
          return send({ action: 'updateEntry', notebookId, entryId, text, images, tags }, 'keep')
        },
        deleteEntry (notebookId, entryId) {
          return send({ action: 'deleteEntry', notebookId, entryId }, 'keep')
        },
        deleteEntries (notebookId, entryIds) {
          return send({ action: 'deleteEntries', notebookId, entryIds }, 'keep')
        },
        remove (notebookId) {
          return send({ action: 'delete', notebookId })
        },
        restoreTrash (trashId) {
          return send({ action: 'restoreTrash', trashId })
        },
        purgeTrash (trashId) {
          return send({ action: 'purgeTrash', trashId })
        },
        emptyTrash () {
          return send({ action: 'emptyTrash' })
        },
        moveEntries (notebookId, entryIds, targetNotebookId) {
          return send({ action: 'moveEntries', notebookId, entryIds, targetNotebookId })
        },
        mergeNotebook (notebookId, targetNotebookId) {
          return send({ action: 'mergeNotebook', notebookId, targetNotebookId })
        },
        async uploadImage (file) {
          if (!file || typeof file.type !== 'string' || !/^image\/(png|jpeg|webp|gif)$/u.test(file.type)) {
            const failure = new Error('unsupported image')
            failure.code = 'unsupported-image'
            throw failure
          }
          if (file.size > MAX_IMAGE_BYTES) {
            const failure = new Error('image too large')
            failure.code = 'image-too-large'
            throw failure
          }
          const prepared = await prepareImage(file)
          const data = await readFileDataUrl(prepared)
          const payload = await send({
            action: 'uploadImage',
            mediaType: prepared.type,
            data,
            name: prepared.name || file.name || 'image',
          })
          if (!payload || !payload.image) {
            const failure = new Error('upload failed')
            failure.code = 'generic'
            throw failure
          }
          return payload.image
        },
        ocrImage (id, ext) {
          return send({ action: 'ocrImage', id, ext }, 'keep')
        },
        async fetchImage (url, caption) {
          const payload = await send({ action: 'fetchImage', url, caption })
          if (!payload || !payload.image) {
            const failure = new Error('fetch failed')
            failure.code = 'generic'
            throw failure
          }
          return payload.image
        },
        importFile (kind, payload) {
          return send({ action: 'import', kind, ...payload })
        },
      }
    }

    function createToastStore () {
      let snapshot = null
      let token = 0
      const listeners = new Set()
      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      return {
        subscribe (listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot () {
          return snapshot
        },
        show (message, action) {
          token += 1
          snapshot = { token, message, action: action || null }
          emit()
        },
        dismiss (expected) {
          if (snapshot === null) return
          if (expected !== undefined && snapshot.token !== expected) return
          snapshot = null
          emit()
        },
      }
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply (ctx) {
        const locale = ctx.get('locale')
        const workspaceUi = ctx.get('uiWorkspace')
        const store = createNotebookStore()
        const toasts = createToastStore()

        ctx.effect(() => insertStyles(), 'dshnotebook: styles')

        if (locale) {
          ctx.effect(() => locale.register(NS, 'zh', zh), 'dshnotebook: zh dictionary')
          ctx.effect(() => locale.register(NS, 'en', en), 'dshnotebook: en dictionary')
        }

        const translate = locale && typeof locale.bind === 'function'
          ? locale.bind(NS)
          : (key) => key

        const t = (key, params) => {
          let text = translate(key)
          if (typeof text !== 'string') text = String(text === undefined ? key : text)
          if (params) {
            text = text.replace(/\{(\w+)\}/gu, (match, name) => (
              params[name] === undefined ? match : String(params[name])
            ))
          }
          return text
        }

        const localeId = () => {
          const snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null
          const active = String(snapshot && snapshot.active ? snapshot.active : 'en')
          return active.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
        }

        const useLocaleRevision = () => {
          const [revision, setRevision] = useState(() => (
            locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot().revision : 0
          ))
          useEffect(() => {
            if (!locale || typeof locale.subscribe !== 'function') return undefined
            return locale.subscribe(() => {
              setRevision(locale.getSnapshot().revision)
            })
          }, [])
          return revision
        }

        const useExternal = (subscribe, getSnapshot) => {
          if (typeof React.useSyncExternalStore === 'function') {
            return React.useSyncExternalStore(subscribe, getSnapshot)
          }
          const [, bump] = useState(0)
          useEffect(() => subscribe(() => bump((value) => value + 1)), [subscribe])
          return getSnapshot()
        }

        const formatDateTime = (value) => {
          if (typeof value !== 'string') return '—'
          const date = new Date(value)
          if (Number.isNaN(date.getTime())) return '—'
          return date.toLocaleString(localeId(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        }

        const formatRelative = (value) => {
          const date = new Date(typeof value === 'string' ? value : '')
          if (Number.isNaN(date.getTime())) return '—'
          const diff = Date.now() - date.getTime()
          if (diff < 60000) return t('time.justNow')
          if (diff < 3600000) return t('time.minutes', { count: Math.floor(diff / 60000) })
          if (diff < 86400000) return t('time.hours', { count: Math.floor(diff / 3600000) })
          if (diff < 7 * 86400000) return t('time.days', { count: Math.floor(diff / 86400000) })
          return date.toLocaleDateString(localeId(), { month: 'numeric', day: 'numeric' })
        }

        const describeError = (error) => {
          const code = error && typeof error.code === 'string' ? error.code : ''
          if (code === 'invalid-name') return t('error.name')
          if (code === 'not-found') return t('error.notFound')
          if (code === 'entry-not-found') return t('error.entryNotFound')
          if (code === 'limit' || code === 'too-large') return t('error.limit')
          if (code === 'invalid-text') return t('error.text')
          if (code === 'offline') return t('error.offline')
          if (code === 'unsupported-image') return t('error.imageFormat')
          if (code === 'image-too-large') return t('error.imageSize')
          if (code === 'invalid-image') return t('error.imageMissing')
          if (code === 'invalid-url' || code === 'unsupported-url') return t('error.url')
          if (code === 'fetch-failed') return t('error.fetchImage')
          if (code === 'ocr-unavailable') return t('error.ocrUnavailable')
          if (code === 'ocr-failed') return t('error.ocrFailed')
          if (code === 'invalid-backup' || code === 'invalid-archive') return t('error.import')
          if (code === 'notebook-missing') return t('error.notebookMissing')
          if (code === 'trash-not-found') return t('error.trash')
          if (error && typeof error.message === 'string' && error.message !== '' && code !== 'internal') {
            return error.message
          }
          return t('error.generic')
        }

        const describeSnapshotError = (snapshot) => describeError({
          code: snapshot.errorCode || 'offline',
          message: snapshot.error || '',
        })

        const findEntry = (snapshot, notebookId, entryId) => {
          const notebook = snapshot.notebooks.find((candidate) => candidate.id === notebookId)
          if (!notebook) return null
          return notebook.entries.find((entry) => entry.id === entryId) || null
        }

        const showWriteToast = (key, notebook, extra) => {
          toasts.show(t(key, { name: notebook.name }), extra || (notebook.id ? { kind: 'view', notebookId: notebook.id } : null))
        }

        const openSourceSession = (sessionId) => {
          if (typeof sessionId !== 'string' || sessionId === '') return
          if (!workspaceUi || typeof workspaceUi.openSession !== 'function') return
          try {
            workspaceUi.openSession(sessionId)
          } catch (error) {
            toasts.show(describeError(error))
          }
        }

        const filenameFromDisposition = (value) => {
          if (typeof value !== 'string' || value === '') return ''
          const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(value)
          if (encoded) {
            try {
              return decodeURIComponent(encoded[1])
            } catch {
              // Fall through to the plain parameter.
            }
          }
          const plain = /filename="?([^";]+)"?/iu.exec(value)
          return plain ? plain[1] : ''
        }

        const downloadBlob = (blob, filename) => {
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = filename
          anchor.rel = 'noopener'
          anchor.click()
          setTimeout(() => URL.revokeObjectURL(url), 2000)
        }

        const fetchDownload = async (url, fallbackName) => {
          const response = await fetch(url, { cache: 'no-store' })
          if (!response.ok) {
            let payload = null
            try {
              payload = await response.json()
            } catch {
              payload = null
            }
            const failure = new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
            failure.code = payload && typeof payload.code === 'string' ? payload.code : 'generic'
            throw failure
          }
          const blob = await response.blob()
          const filename = filenameFromDisposition(response.headers.get('content-disposition')) || fallbackName
          downloadBlob(blob, filename)
        }

        const exportNotebook = async (notebook, entryIds) => {
          try {
            const lang = localeId().startsWith('zh') ? 'zh' : 'en'
            const entriesPart = Array.isArray(entryIds) && entryIds.length > 0
              ? `&entries=${encodeURIComponent(entryIds.join(','))}`
              : ''
            const response = await fetch(`${EXPORT}?notebookId=${encodeURIComponent(notebook.id)}${entriesPart}&lang=${lang}`, { cache: 'no-store' })
            if (!response.ok) {
              let payload = null
              try {
                payload = await response.json()
              } catch {
                payload = null
              }
              const failure = new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
              failure.code = payload && typeof payload.code === 'string' ? payload.code : 'generic'
              throw failure
            }
            const blob = await response.blob()
            const fallbackExt = blob.type.includes('zip') ? 'zip' : 'md'
            const filename = filenameFromDisposition(response.headers.get('content-disposition')) ||
              `${safeFilename(notebook.name)}.${fallbackExt}`
            downloadBlob(blob, filename)
            toasts.show(t('toast.exported', { name: notebook.name }))
          } catch (error) {
            toasts.show(describeError(error))
          }
        }

        const backupNotebook = async (notebook) => {
          if (!store.getSnapshot().compatible) {
            toasts.show(t('error.version'))
            return
          }
          try {
            const fallback = `${safeFilename(notebook ? notebook.name : 'dshnotebook-backup')}.json`
            const query = notebook ? `?format=json&notebookId=${encodeURIComponent(notebook.id)}` : '?format=json'
            await fetchDownload(`${EXPORT}${query}`, fallback)
            toasts.show(t('panel.backupDone'))
          } catch (error) {
            toasts.show(describeError(error))
          }
        }

        /* --------------------------------- views -------------------------------- */

        function MoreMenu (props) {
          useLocaleRevision()
          const [open, setOpen] = useState(false)
          const rootRef = useRef(null)
          useEffect(() => {
            if (!open) return undefined
            const onDown = (event) => {
              if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false)
            }
            const onKey = (event) => {
              if (event.key === 'Escape') setOpen(false)
            }
            document.addEventListener('mousedown', onDown, true)
            document.addEventListener('keydown', onKey, true)
            return () => {
              document.removeEventListener('mousedown', onDown, true)
              document.removeEventListener('keydown', onKey, true)
            }
          }, [open])
          const items = (props.items || []).filter(Boolean)
          return h('div', { className: 'dsn-menu', ref: rootRef },
            h('button', {
              type: 'button',
              className: 'dsn-iconBtn',
              'aria-haspopup': 'menu',
              'aria-expanded': open,
              'aria-label': props.label || t('panel.more'),
              title: props.label || t('panel.more'),
              onClick: () => setOpen((value) => !value),
            }, h(IconMore)),
            open
              ? h('div', { className: 'dsn-menuList', role: 'menu' }, items.map((item, index) => h('button', {
                key: index,
                type: 'button',
                role: 'menuitem',
                className: `dsn-menuEntry${item.danger ? ' dsn-danger' : ''}`,
                onClick: () => {
                  setOpen(false)
                  item.onSelect()
                },
              }, item.label)))
              : null)
        }

        function Modal (props) {
          useEffect(() => {
            const onKeyDown = (event) => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              props.onClose()
            }
            window.addEventListener('keydown', onKeyDown, true)
            return () => window.removeEventListener('keydown', onKeyDown, true)
          }, [props.onClose])
          return h('div', {
            className: 'dsn-backdrop',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) props.onClose()
            },
          },
          h('div', {
            className: `dsn-modal${props.wide ? ' dsn-modalWide' : ''}`,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': props.title,
          },
          h('div', { className: 'dsn-modalHead' },
            h('h2', { className: 'dsn-modalTitle' }, props.title),
            h('button', {
              type: 'button',
              className: 'dsn-iconBtn',
              'aria-label': t('panel.close'),
              onClick: props.onClose,
            }, h(IconClose))),
          h('div', { className: 'dsn-modalBody' }, props.children)))
        }

        function NotebookPickerDialog (props) {
          const candidates = props.notebooks.filter((notebook) => notebook.id !== props.excludeId)
          return h(Modal, { title: props.title, onClose: props.onClose },
            props.hint ? h('p', { className: 'dsn-modalText' }, props.hint) : null,
            candidates.length === 0
              ? h('p', { className: 'dsn-hint' }, t('panel.pickEmpty'))
              : h('div', { className: 'dsn-pickList' }, candidates.map((notebook) => h('button', {
                key: notebook.id,
                type: 'button',
                className: 'dsn-pickItem',
                onClick: () => props.onPick(notebook),
              },
              h('span', { className: 'dsn-pickName', key: 'name' }, notebook.name),
              h('span', { className: 'dsn-pickMeta', key: 'meta' }, t('panel.entryCount', { count: notebook.entries.length }))))))
        }

        function NotebookPanel () {
          useLocaleRevision()
          const snapshot = useExternal(store.subscribe, store.getSnapshot)
          const [dialog, setDialog] = useState(null)
          const [query, setQuery] = useState('')
          const [sortMode, setSortMode] = useState(() => {
            try {
              const stored = localStorage.getItem(SORT_KEY)
              return stored === 'created' || stored === 'name' ? stored : 'updated'
            } catch {
              return 'updated'
            }
          })
          const [editing, setEditing] = useState(null)
          const [saveState, setSaveState] = useState('idle')
          const [saveError, setSaveError] = useState(null)
          const [editorError, setEditorError] = useState(null)
          const [uploading, setUploading] = useState(false)
          const [selectMode, setSelectMode] = useState(false)
          const [selectedIds, setSelectedIds] = useState([])
          const [tagFilter, setTagFilter] = useState('')
          const [workspaceFilter, setWorkspaceFilter] = useState('')
          const [viewer, setViewer] = useState(null)
          const [viewerZoom, setViewerZoom] = useState(1)
          const [focusEntryId, setFocusEntryId] = useState('')
          const [highlightQuery, setHighlightQuery] = useState('')
          const [importing, setImporting] = useState(false)
          const [ocrBusy, setOcrBusy] = useState('')
          const [sessionFilter, setSessionFilter] = useState('')
          const editingRef = useRef(null)
          editingRef.current = editing
          const saveTimerRef = useRef(null)
          const saveChainRef = useRef(Promise.resolve())
          const entryRefs = useRef(new Map())
          const importInputRef = useRef(null)
          const imageInputRef = useRef(null)
          const editorRef = useRef(null)

          const notebooks = snapshot.notebooks
          const selected = notebooks.find((notebook) => notebook.id === snapshot.selectedId) || null
          const compatible = snapshot.compatible
          const trashCount = snapshot.trash.length

          const requireCompatible = () => {
            if (store.getSnapshot().compatible) return true
            toasts.show(t('error.version'))
            return false
          }

          const editingEntry = editing === null
            ? null
            : findEntry(snapshot, editing.notebookId, editing.entryId)
          const editingTags = editing === null ? [] : parseTags(editing.tagsText)
          const draftMatchesEntry = editing !== null && editingEntry !== null &&
            editing.text === editingEntry.text &&
            sameImages(editing.images, editingEntry.images) &&
            sameTags(editingTags, editingEntry.tags)

          useEffect(() => {
            store.load()
          }, [])

          useEffect(() => {
            try {
              localStorage.setItem(SORT_KEY, sortMode)
            } catch {
              // Storage may be unavailable; sorting still works for this session.
            }
          }, [sortMode])

          useEffect(() => {
            if (editing === null) return
            if (!notebooks.some((notebook) => notebook.id === editing.notebookId)) {
              setEditing(null)
              setSaveState('idle')
            }
          }, [notebooks, editing])

          useEffect(() => {
            if (editing === null) return undefined
            if (saveTimerRef.current !== null) {
              clearTimeout(saveTimerRef.current)
              saveTimerRef.current = null
            }
            saveTimerRef.current = setTimeout(() => {
              saveTimerRef.current = null
              void queueSave()
            }, AUTOSAVE_MS)
            return () => {
              if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current)
                saveTimerRef.current = null
              }
            }
          }, [
            editing === null ? '' : editing.text,
            editing === null ? '' : editing.tagsText,
            editing === null ? '' : editing.images.map((image) => `${image.id}:${image.caption || ''}`).join('|'),
          ])

          useEffect(() => {
            if (editing === null || selected === null) return
            if (selected.id === editing.notebookId) return
            if (saveTimerRef.current !== null) {
              clearTimeout(saveTimerRef.current)
              saveTimerRef.current = null
            }
            const current = editingRef.current
            if (current !== null && current.isNew && current.text.trim() === '' && current.images.length === 0 && parseTags(current.tagsText).length === 0) {
              store.deleteEntry(current.notebookId, current.entryId).catch(() => {})
            } else {
              void queueSave().then((ok) => {
                if (!ok) toasts.show(t('error.save'))
              })
            }
            setEditing(null)
            setSaveState('idle')
          }, [selected === null ? '' : selected.id])

          useEffect(() => {
            if (editing === null || editorRef.current === null) return
            editorRef.current.scrollIntoView({ block: 'nearest' })
          }, [editing === null ? '' : editing.entryId])

          useEffect(() => {
            if (focusEntryId === '') return
            const node = entryRefs.current.get(focusEntryId)
            if (node) node.scrollIntoView({ block: 'center' })
          }, [focusEntryId, selected === null ? '' : selected.id, editing === null ? '' : editing.entryId])

          useEffect(() => {
            if (viewer === null) return undefined
            const onKey = (event) => {
              if (event.key === 'Escape') setViewer(null)
            }
            window.addEventListener('keydown', onKey, true)
            return () => window.removeEventListener('keydown', onKey, true)
          }, [viewer])

          const performSave = async (draft) => {
            const current = editingRef.current
            if (!current || current.entryId !== draft.entryId) return true
            if (!store.getSnapshot().compatible) {
              setSaveState('error')
              setSaveError(t('error.version'))
              return false
            }
            const tags = parseTags(current.tagsText)
            if (current.isNew && current.text.trim() === '' && current.images.length === 0 && tags.length === 0) {
              setSaveState('saved')
              return true
            }
            const entry = findEntry(store.getSnapshot(), current.notebookId, current.entryId)
            if (entry && entry.text === current.text && sameImages(entry.images, current.images) && sameTags(entry.tags, tags)) {
              setSaveState('saved')
              return true
            }
            setSaveState('saving')
            setSaveError(null)
            try {
              await store.updateEntry(current.notebookId, current.entryId, current.text, current.images, tags)
              if (editingRef.current && editingRef.current.entryId === current.entryId) setSaveState('saved')
              return true
            } catch (error) {
              setSaveState('error')
              setSaveError(describeError(error))
              toasts.show(describeError(error))
              return false
            }
          }

          const queueSave = () => {
            const current = editingRef.current
            if (!current) return Promise.resolve(true)
            const run = saveChainRef.current.then(() => performSave(current))
            saveChainRef.current = run.catch(() => {})
            return run
          }

          const beginEdit = async (notebook, entry) => {
            if (!store.getSnapshot().compatible) {
              toasts.show(t('error.version'))
              return
            }
            if (editing !== null) {
              const ok = await finishEdit()
              if (!ok) return
            }
            setSelectMode(false)
            setSelectedIds([])
            setFocusEntryId('')
            setEditorError(null)
            setSaveState('idle')
            setSaveError(null)
            setEditing({
              notebookId: notebook.id,
              entryId: entry.id,
              text: entry.text,
              tagsText: entry.tags.join(', '),
              images: entry.images.slice(),
              original: {
                text: entry.text,
                images: entry.images.slice(),
                tags: entry.tags.slice(),
              },
              isNew: false,
            })
          }

          const createNote = async () => {
            if (selected === null) return
            if (!store.getSnapshot().compatible) {
              toasts.show(t('error.version'))
              return
            }
            if (editing !== null) {
              const ok = await finishEdit()
              if (!ok) return
            }
            try {
              const payload = await store.addEntry(selected.id)
              setEditorError(null)
              setSaveState('idle')
              setSaveError(null)
              setEditing({
                notebookId: selected.id,
                entryId: payload.entryId,
                text: '',
                tagsText: '',
                images: [],
                original: { text: '', images: [], tags: [] },
                isNew: true,
              })
            } catch (error) {
              toasts.show(describeError(error))
            }
          }

          const finishEdit = async () => {
            const current = editingRef.current
            if (!current) return true
            if (saveTimerRef.current !== null) {
              clearTimeout(saveTimerRef.current)
              saveTimerRef.current = null
            }
            const tags = parseTags(current.tagsText)
            if (current.isNew && current.text.trim() === '' && current.images.length === 0 && tags.length === 0) {
              setEditing(null)
              setSaveState('idle')
              store.deleteEntry(current.notebookId, current.entryId).catch(() => {})
              return true
            }
            const ok = await queueSave()
            if (ok) {
              setEditing(null)
              setSaveState('idle')
            }
            return ok
          }

          const ensureEditableSaved = async (notebookId) => {
            if (editing === null || editing.notebookId !== notebookId) return true
            return finishEdit()
          }

          const cancelEdit = async () => {
            const current = editingRef.current
            if (!current) return
            if (saveTimerRef.current !== null) {
              clearTimeout(saveTimerRef.current)
              saveTimerRef.current = null
            }
            setEditing(null)
            setSaveState('idle')
            setSaveError(null)
            if (current.isNew) {
              saveChainRef.current = saveChainRef.current
                .then(() => store.deleteEntry(current.notebookId, current.entryId))
                .catch(() => {})
              return
            }
            const original = current.original
            saveChainRef.current = saveChainRef.current.then(async () => {
              const entry = findEntry(store.getSnapshot(), current.notebookId, current.entryId)
              if (!entry) return
              if (entry.text === original.text && sameImages(entry.images, original.images) && sameTags(entry.tags, original.tags)) return
              await store.updateEntry(current.notebookId, current.entryId, original.text, original.images, original.tags)
            }).catch((error) => {
              toasts.show(describeError(error))
            })
          }

          const addFiles = async (files) => {
            const draft = editingRef.current
            if (!draft || files.length === 0) return
            if (draft.images.length + files.length > MAX_IMAGES) {
              setEditorError(t('error.imageCount'))
              return
            }
            setUploading(true)
            setEditorError(null)
            for (const file of files) {
              try {
                const image = await store.uploadImage(file)
                setEditing((previous) => (
                  previous !== null && previous.entryId === draft.entryId
                    ? { ...previous, images: [...previous.images, image] }
                    : previous
                ))
              } catch (error) {
                setEditorError(describeError(error))
              }
            }
            setUploading(false)
          }

          const handlePaste = (event) => {
            const data = event.clipboardData
            if (!data) return
            const files = []
            if (data.items) {
              for (let index = 0; index < data.items.length; index += 1) {
                const item = data.items[index]
                if (!item || item.kind !== 'file' || !item.type.startsWith('image/')) continue
                const file = item.getAsFile()
                if (file) files.push(file)
              }
            }
            if (files.length === 0 && data.files) {
              for (let index = 0; index < data.files.length; index += 1) {
                const file = data.files[index]
                if (file && file.type.startsWith('image/')) files.push(file)
              }
            }
            if (files.length === 0) return
            event.preventDefault()
            void addFiles(files)
          }

          const handleDrop = (event) => {
            event.preventDefault()
            const data = event.dataTransfer
            if (!data || !data.files || data.files.length === 0) return
            const files = Array.from(data.files).filter((file) => file.type.startsWith('image/'))
            if (files.length === 0) return
            void addFiles(files)
          }

          const removeDraftImage = (imageId) => {
            setEditing((previous) => (
              previous === null ? previous : { ...previous, images: previous.images.filter((image) => image.id !== imageId) }
            ))
          }

          const updateCaption = (imageId, caption) => {
            setEditing((previous) => (
              previous === null
                ? previous
                : {
                  ...previous,
                  images: previous.images.map((image) => (
                    image.id === imageId ? { ...image, caption } : image
                  )),
                }
            ))
          }

          const addFetchedImage = (image) => {
            setEditing((previous) => (previous === null ? previous : { ...previous, images: [...previous.images, image] }))
          }

          const runOcr = async (image) => {
            if (!store.getSnapshot().compatible) {
              toasts.show(t('error.version'))
              return
            }
            setOcrBusy(image.id)
            setEditorError(null)
            try {
              const payload = await store.ocrImage(image.id, imageExt(image))
              const text = payload && typeof payload.text === 'string' ? payload.text.trim() : ''
              if (text === '') {
                setEditorError(t('panel.ocrEmpty'))
                return
              }
              setEditing((previous) => (
                previous === null
                  ? previous
                  : {
                    ...previous,
                    text: previous.text.trim() === '' ? text : `${previous.text}\n\n${text}`,
                  }
              ))
            } catch (error) {
              setEditorError(describeError(error))
            } finally {
              setOcrBusy('')
            }
          }

          const selectNotebook = async (notebookId) => {
            if (notebookId === snapshot.selectedId) return
            if (editing !== null) {
              const ok = await finishEdit()
              if (!ok) return
            }
            setSelectMode(false)
            setSelectedIds([])
            setTagFilter('')
            setWorkspaceFilter('')
            setSessionFilter('')
            setFocusEntryId('')
            setHighlightQuery('')
            setDialog(null)
            store.select(notebookId)
          }

          const deleteNote = async (notebook, entry) => {
            if (!store.getSnapshot().compatible) {
              toasts.show(t('error.version'))
              return
            }
            try {
              const payload = await store.deleteEntry(notebook.id, entry.id)
              toasts.show(t('toast.deletedNote'), payload && payload.trashId
                ? { kind: 'restore', trashId: payload.trashId }
                : null)
              if (focusEntryId === entry.id) setFocusEntryId('')
            } catch (error) {
              toasts.show(describeError(error))
            }
          }

          const toggleSelection = (entryId) => {
            setSelectedIds((previous) => (
              previous.includes(entryId) ? previous.filter((id) => id !== entryId) : [...previous, entryId]
            ))
          }

          const deleteSelected = async () => {
            if (selected === null || selectedIds.length === 0) return
            try {
              await store.deleteEntries(selected.id, selectedIds)
              toasts.show(t('toast.deletedNotes', { count: selectedIds.length }))
              setSelectedIds([])
              setSelectMode(false)
            } catch (error) {
              toasts.show(describeError(error))
            }
          }

          const exportSelected = () => {
            if (selected === null || selectedIds.length === 0) return
            void exportNotebook(selected, selectedIds)
          }

          const handleImportFile = async (file) => {
            if (!file) return
            if (file.size > MAX_IMPORT_BYTES) {
              toasts.show(t('error.limit'))
              return
            }
            if (!requireCompatible()) return
            const name = file.name || 'import'
            const lower = name.toLowerCase()
            setImporting(true)
            try {
              if (lower.endsWith('.json')) {
                const text = await file.text()
                let backup
                try {
                  backup = JSON.parse(text)
                } catch {
                  throw Object.assign(new Error('invalid json'), { code: 'invalid-backup' })
                }
                const payload = await store.importFile('json', { backup })
                const names = (payload.imported || []).map((item) => item.name).join('、')
                toasts.show(t('toast.imported', { name: names || name }))
              } else if (lower.endsWith('.zip')) {
                const buffer = await file.arrayBuffer()
                const payload = await store.importFile('zip', { data: bufferToBase64(buffer), name })
                const names = (payload.imported || []).map((item) => item.name).join('、')
                toasts.show(t('toast.imported', { name: names || name }))
              } else if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
                const text = await file.text()
                const payload = await store.importFile('markdown', { name, text })
                const names = (payload.imported || []).map((item) => item.name).join('、')
                toasts.show(t('toast.imported', { name: names || name }))
              } else {
                toasts.show(t('error.import'))
              }
            } catch (error) {
              toasts.show(describeError(error))
            } finally {
              setImporting(false)
            }
          }

          const sortedNotebooks = notebooks.slice().sort((left, right) => {
            if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
            if (sortMode === 'name') return left.name.localeCompare(right.name, localeId())
            if (sortMode === 'created') return Date.parse(right.createdAt) - Date.parse(left.createdAt)
            return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
          })

          const queryText = query.trim()
          const searchResults = []
          if (queryText !== '') {
            const needle = queryText.toLowerCase()
            for (const notebook of sortedNotebooks) {
              let matched = false
              for (const entry of notebook.entries) {
                if (!entry.text.toLowerCase().includes(needle)) continue
                matched = true
                searchResults.push({
                  notebook,
                  entry,
                  snippet: snippetOf(entry.text, queryText),
                })
                if (searchResults.length >= 80) break
              }
              if (!matched && notebook.name.toLowerCase().includes(needle)) {
                searchResults.push({ notebook, entry: null, snippet: '' })
              }
              if (searchResults.length >= 80) break
            }
          }

          const notebookTags = []
          const notebookWorkspaces = []
          const notebookSessions = []
          if (selected !== null) {
            const seenTags = new Set()
            const seenWorkspaces = new Set()
            const seenSessions = new Set()
            for (const entry of selected.entries) {
              for (const tag of entry.tags) {
                if (seenTags.has(tag)) continue
                seenTags.add(tag)
                notebookTags.push(tag)
              }
              const source = entry.source || {}
              if (source.workspace && !seenWorkspaces.has(source.workspace)) {
                seenWorkspaces.add(source.workspace)
                notebookWorkspaces.push(source.workspace)
              }
              if (source.sessionId && !seenSessions.has(source.sessionId)) {
                seenSessions.add(source.sessionId)
                notebookSessions.push({ id: source.sessionId, title: source.sessionTitle || source.sessionId })
              }
            }
          }

          const filteredEntries = selected === null
            ? []
            : selected.entries.filter((entry) => (
              (tagFilter === '' || entry.tags.includes(tagFilter)) &&
              (workspaceFilter === '' || (entry.source && entry.source.workspace === workspaceFilter)) &&
              (sessionFilter === '' || (entry.source && entry.source.sessionId === sessionFilter))
            ))
          const displayEntries = filteredEntries.slice().reverse()
          if (editing !== null && selected !== null && editing.notebookId === selected.id && !displayEntries.some((entry) => entry.id === editing.entryId)) {
            // Never hide an open editor behind a tag or workspace filter.
            const activeEntry = selected.entries.find((entry) => entry.id === editing.entryId)
            if (activeEntry) displayEntries.unshift(activeEntry)
          }

          const renderGallery = (images, editable) => {
            if (images.length === 0) return null
            return h('div', { className: 'dsn-gallery', key: 'gallery' }, images.map((image) => (
              editable
                ? h('div', { className: 'dsn-thumbWrap', key: image.id },
                  h('div', { className: 'dsn-thumbBox' },
                    h('img', { src: imageUrl(image), alt: image.name }),
                    h('button', {
                      type: 'button',
                      className: 'dsn-thumbRemove',
                      'aria-label': t('panel.removeImage'),
                      title: t('panel.removeImage'),
                      onClick: () => removeDraftImage(image.id),
                    }, '×')),
                  h('input', {
                    className: 'dsn-captionInput',
                    type: 'text',
                    value: image.caption || '',
                    maxLength: 200,
                    placeholder: t('panel.imageCaptionPlaceholder'),
                    'aria-label': t('panel.imageCaptionPlaceholder'),
                    onChange: (event) => updateCaption(image.id, event.target.value),
                  }),
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btnSmall',
                    disabled: ocrBusy !== '' || uploading,
                    onClick: (event) => {
                      event.stopPropagation()
                      void runOcr(image)
                    },
                  }, ocrBusy === image.id ? t('panel.ocrBusy') : t('panel.ocr')))
                : h('figure', { className: 'dsn-figure', key: image.id },
                  h('button', {
                    type: 'button',
                    className: 'dsn-thumb',
                    'aria-label': t('panel.viewImage'),
                    title: t('panel.viewImage'),
                    onClick: (event) => {
                      event.stopPropagation()
                      setViewerZoom(1)
                      setViewer(image)
                    },
                  }, h('img', { src: imageUrl(image), alt: image.caption || image.name, loading: 'lazy' })),
                  image.caption ? h('figcaption', { className: 'dsn-caption' }, image.caption) : null)
            )))
          }

          const renderEntry = (notebook, entry) => {
            const isEditing = editing !== null && editing.notebookId === notebook.id && editing.entryId === entry.id
            if (isEditing) {
              return h('li', { key: entry.id, className: 'dsn-entry', ref: editorRef },
                h('div', {
                  className: 'dsn-editor',
                  onPaste: handlePaste,
                  onDrop: handleDrop,
                  onDragOver: (event) => { event.preventDefault() },
                },
                h('textarea', {
                  className: 'dsn-textarea',
                  value: editing.text,
                  rows: 6,
                  autoFocus: true,
                  'aria-label': t('panel.noteTextLabel'),
                  placeholder: t('panel.notePlaceholder'),
                  onChange: (event) => {
                    const value = event.target.value
                    setEditing((previous) => (previous === null ? previous : { ...previous, text: value }))
                  },
                }),
                h('div', { className: 'dsn-field' },
                  h('label', { className: 'dsn-label', htmlFor: `dsn-tags-${entry.id}` }, t('panel.tagsLabel')),
                  h('input', {
                    id: `dsn-tags-${entry.id}`,
                    className: 'dsn-tagsInput',
                    type: 'text',
                    value: editing.tagsText,
                    placeholder: t('panel.tagsPlaceholder'),
                    onChange: (event) => {
                      const value = event.target.value
                      setEditing((previous) => (previous === null ? previous : { ...previous, tagsText: value }))
                    },
                  })),
                renderGallery(editing.images, true),
                h('div', { className: 'dsn-editorBar', key: 'bar' },
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btnSmall',
                    disabled: uploading || editing.images.length >= MAX_IMAGES,
                    onClick: () => { if (imageInputRef.current !== null) imageInputRef.current.click() },
                  }, h(IconPlus, { key: 'icon' }), h('span', { key: 'text' }, t('panel.addImage'))),
                  h('input', {
                    ref: imageInputRef,
                    type: 'file',
                    accept: 'image/png,image/jpeg,image/webp,image/gif',
                    multiple: true,
                    style: { display: 'none' },
                    onChange: (event) => {
                      const files = Array.from(event.target.files || [])
                      event.target.value = ''
                      if (files.length > 0) void addFiles(files)
                    },
                  }),
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btnSmall',
                    disabled: uploading || editing.images.length >= MAX_IMAGES,
                    onClick: () => setDialog({ kind: 'urlImage' }),
                  }, h('span', { key: 'text' }, t('panel.imageUrl'))),
                  h('span', { className: 'dsn-editorHint', key: 'hint' }, uploading ? t('panel.uploading') : t('panel.pasteHint')),
                  h('span', {
                    className: 'dsn-editorStatus',
                    key: 'status',
                    'data-tone': saveState === 'error' ? 'error' : undefined,
                  }, saveState === 'saving'
                    ? t('panel.saving')
                    : saveState === 'error'
                      ? (saveError || t('panel.saveFailed'))
                      : draftMatchesEntry ? t('panel.saved') : t('panel.pendingSave')),
                  h('div', { className: 'dsn-editorActions', key: 'actions' },
                    h('button', {
                      type: 'button',
                      className: 'dsn-btn',
                      disabled: saveState === 'saving',
                      onClick: () => { void cancelEdit() },
                    }, t('panel.cancelEdit')),
                    h('button', {
                      type: 'button',
                      className: 'dsn-btn dsn-btnPrimary',
                      disabled: saveState === 'saving' || uploading,
                      onClick: () => { void finishEdit() },
                    }, t('panel.finish')))),
                editorError !== null
                  ? h('p', { className: 'dsn-errorText', key: 'error' }, editorError)
                  : null))
            }

            const isSelected = selectedIds.includes(entry.id)
            const isFocused = focusEntryId === entry.id
            return h('li', {
              key: entry.id,
              className: 'dsn-entry',
              'data-focused': isFocused ? 'true' : undefined,
              'data-selected': isSelected ? 'true' : undefined,
              ref: (element) => {
                if (element) entryRefs.current.set(entry.id, element)
                else entryRefs.current.delete(entry.id)
              },
              onClick: selectMode ? () => toggleSelection(entry.id) : undefined,
            },
            h('div', { className: 'dsn-entryHead' },
              selectMode
                ? h('input', {
                  type: 'checkbox',
                  className: 'dsn-selectBox',
                  checked: isSelected,
                  'aria-label': t('panel.select'),
                  onChange: () => toggleSelection(entry.id),
                  onClick: (event) => event.stopPropagation(),
                })
                : h('time', { className: 'dsn-entryTime', dateTime: entry.createdAt }, formatDateTime(entry.createdAt)),
              h('div', { className: 'dsn-entryActions' },
                selectMode
                  ? null
                  : [
                    h('button', {
                      key: 'edit',
                      type: 'button',
                      className: 'dsn-entryAction',
                      'aria-label': t('panel.editNote'),
                      title: t('panel.editNote'),
                      onClick: (event) => {
                        event.stopPropagation()
                        void beginEdit(notebook, entry)
                      },
                    }, h(IconEdit)),
                    h('button', {
                      key: 'delete',
                      type: 'button',
                      className: 'dsn-entryAction dsn-danger',
                      'aria-label': t('panel.deleteNote'),
                      title: t('panel.deleteNote'),
                      onClick: (event) => {
                        event.stopPropagation()
                        void deleteNote(notebook, entry)
                      },
                    }, h(IconTrash)),
                  ])),
            entry.text.trim() === ''
              ? h('p', { className: 'dsn-emptyNote', key: 'empty' }, t('panel.emptyNote'))
              : h('div', { key: 'md' }, renderMarkdown(entry.text, isFocused ? highlightQuery : '')),
            renderGallery(entry.images, false),
            entry.tags.length > 0
              ? h('div', { className: 'dsn-noteTags', key: 'tags' }, entry.tags.map((tag) => h('button', {
                key: tag,
                type: 'button',
                className: 'dsn-noteTag',
                onClick: (event) => {
                  event.stopPropagation()
                  setTagFilter(tag)
                },
              }, tag)))
              : null,
            (entry.source && (entry.source.sessionTitle || entry.source.workspace)) || entry.updatedAt !== entry.createdAt
              ? h('div', { className: 'dsn-entryMeta', key: 'meta' },
                entry.source && entry.source.sessionTitle
                  ? (entry.source.sessionId && workspaceUi
                      ? h('button', {
                        type: 'button',
                        className: 'dsn-source',
                        title: t('panel.openSession'),
                        onClick: (event) => {
                          event.stopPropagation()
                          openSourceSession(entry.source.sessionId)
                        },
                      }, entry.source.sessionTitle)
                      : h('span', { className: 'dsn-sourceStatic' }, entry.source.sessionTitle))
                  : null,
                entry.source && entry.source.sessionTitle && entry.source.workspace
                  ? h('span', { className: 'dsn-metaDot', key: 'dot' }, '·')
                  : null,
                entry.source && entry.source.workspace
                  ? h('span', { className: 'dsn-sourceStatic', key: 'workspace', title: entry.source.workspace }, entry.source.workspace)
                  : null,
                entry.updatedAt !== entry.createdAt
                  ? h('span', { className: 'dsn-metaDot', key: 'editedDot' }, '·')
                  : null,
                entry.updatedAt !== entry.createdAt
                  ? h('span', { key: 'edited' }, t('panel.editedAt', { date: formatDateTime(entry.updatedAt) }))
                  : null)
              : null)
          }

          const renderSide = () => {
            const tools = h('div', { className: 'dsn-sideTools', key: 'tools' },
              h('div', { className: 'dsn-search', key: 'search' },
                h('input', {
                  className: 'dsn-searchInput',
                  type: 'text',
                  value: query,
                  placeholder: t('panel.searchPlaceholder'),
                  'aria-label': t('panel.searchPlaceholder'),
                  onChange: (event) => { setQuery(event.target.value) },
                  onKeyDown: (event) => {
                    if (event.key === 'Escape' && query !== '') {
                      event.preventDefault()
                      setQuery('')
                      setFocusEntryId('')
                      setHighlightQuery('')
                    }
                  },
                }),
                query !== ''
                  ? h('button', {
                    type: 'button',
                    className: 'dsn-searchClear',
                    'aria-label': t('panel.clearSearch'),
                    onClick: () => {
                      setQuery('')
                      setFocusEntryId('')
                      setHighlightQuery('')
                    },
                  }, h(IconClose))
                  : null),
              h('div', { className: 'dsn-sideRow', key: 'sort' },
                h('label', { className: 'dsn-label', htmlFor: 'dsn-sort' }, t('panel.sort')),
                h('select', {
                  id: 'dsn-sort',
                  className: 'dsn-select',
                  value: sortMode,
                  onChange: (event) => setSortMode(event.target.value),
                },
                h('option', { value: 'updated' }, t('sort.updated')),
                h('option', { value: 'created' }, t('sort.created')),
                h('option', { value: 'name' }, t('sort.name')))))

            if (queryText !== '') {
              return h('aside', { className: 'dsn-side', key: 'side' },
                tools,
                h('p', { className: 'dsn-hint', key: 'count' }, t('panel.searchCount', { count: searchResults.length })),
                searchResults.length === 0
                  ? h('p', { className: 'dsn-hint', key: 'empty' }, t('panel.searchEmpty'))
                  : h('div', { className: 'dsn-list', key: 'results' }, searchResults.map((result) => h('button', {
                    key: `${result.notebook.id}:${result.entry ? result.entry.id : 'notebook'}`,
                    type: 'button',
                    className: 'dsn-result',
                    onClick: () => {
                      setSelectMode(false)
                      setSelectedIds([])
                      setTagFilter('')
                      setWorkspaceFilter('')
                      setSessionFilter('')
                      if (result.entry) {
                        setFocusEntryId(result.entry.id)
                        setHighlightQuery(queryText)
                      }
                      store.select(result.notebook.id)
                    },
                  },
                  h('div', { className: 'dsn-resultTop' },
                    h('span', { className: 'dsn-resultName', key: 'name' }, result.notebook.name),
                    h('span', { className: 'dsn-resultTime', key: 'time' }, result.entry ? formatRelative(result.entry.updatedAt) : '')),
                  h('span', { className: 'dsn-resultSnippet', key: 'snippet' },
                    result.entry
                      ? highlightParts(result.snippet, 'r', queryText)
                      : t('panel.searchHint'))))))
            }

            return h('aside', { className: 'dsn-side', key: 'side' },
              tools,
              snapshot.phase === 'error'
                ? h('div', { className: 'dsn-error', key: 'error' },
                  h('p', null, describeSnapshotError(snapshot)),
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn',
                    key: 'retry',
                    onClick: () => { store.load() },
                  }, t('panel.retry')))
                : null,
              snapshot.phase === 'loading' && notebooks.length === 0
                ? h('p', { className: 'dsn-hint', key: 'loading' }, t('panel.loading'))
                : null,
              snapshot.phase === 'ready' && notebooks.length === 0
                ? h('div', { className: 'dsn-empty', key: 'empty' },
                  h(NotebookGlyph, { key: 'icon', size: 30 }),
                  h('p', { className: 'dsn-emptyTitle', key: 'title' }, t('panel.empty')),
                  h('p', { className: 'dsn-emptyHint', key: 'hint' }, t('panel.emptyHint')))
                : null,
              sortedNotebooks.length > 0
                ? h('ul', { className: 'dsn-list', key: 'list' }, sortedNotebooks.map((notebook) => h('li', { key: notebook.id },
                  h('button', {
                    type: 'button',
                    className: `dsn-nb${notebook.id === snapshot.selectedId ? ' dsn-nbActive' : ''}`,
                    'aria-current': notebook.id === snapshot.selectedId ? 'true' : undefined,
                    onClick: () => { void selectNotebook(notebook.id) },
                  },
                  h(NotebookGlyph, { key: 'icon', size: 15 }),
                  h('span', { className: 'dsn-nbText', key: 'text' },
                    h('span', { className: 'dsn-nbName', key: 'name' }, notebook.name),
                    h('span', { className: 'dsn-nbMeta', key: 'meta' },
                      t('panel.entryCount', { count: notebook.entries.length }),
                      ' · ',
                      formatRelative(notebook.updatedAt))),
                  notebook.pinned ? h('span', { className: 'dsn-pinMark', key: 'pin' }, h(IconStar, { filled: true })) : null))))
                : null)
          }

          const renderDetail = () => {
            if (selected === null) {
              return h('section', { className: 'dsn-detail', key: 'detail', 'aria-label': t('panel.detailEmpty') },
                h('div', { className: 'dsn-detailEmpty' },
                  h(NotebookGlyph, { key: 'icon', size: 32 }),
                  h('p', { key: 'text' }, notebooks.length === 0 ? t('panel.empty') : t('panel.detailEmpty'))))
            }
            const hasImages = selected.entries.some((entry) => entry.images.length > 0)
            const allSelected = displayEntries.length > 0 && displayEntries.every((entry) => selectedIds.includes(entry.id))
            return h('section', {
              className: 'dsn-detail',
              key: `detail-${selected.id}`,
              'aria-label': selected.name,
            },
            h('header', { className: 'dsn-detailHead', key: 'head' },
              h('div', { className: 'dsn-detailTitleWrap', key: 'title' },
                h('div', { className: 'dsn-detailTitleRow' },
                  h('h2', { className: 'dsn-detailTitle', key: 'name' }, selected.name),
                  h('button', {
                    type: 'button',
                    className: 'dsn-iconBtn',
                    key: 'pin',
                    'aria-label': selected.pinned ? t('panel.unpin') : t('panel.pin'),
                    title: selected.pinned ? t('panel.unpin') : t('panel.pin'),
                    disabled: !compatible,
                    onClick: () => {
                      if (!requireCompatible()) return
                      void store.pin(selected.id, !selected.pinned).catch((error) => toasts.show(describeError(error)))
                    },
                  }, h(IconStar, { filled: selected.pinned })),
                  h(MoreMenu, {
                    key: 'more',
                    label: t('panel.more'),
                    items: [
                      {
                        label: t('panel.rename'),
                        onSelect: () => {
                          if (!requireCompatible()) return
                          setDialog({ kind: 'rename', notebook: selected })
                        },
                      },
                      {
                        label: t('panel.merge'),
                        onSelect: () => {
                          void (async () => {
                            if (!requireCompatible()) return
                            if (!(await ensureEditableSaved(selected.id))) return
                            setDialog({ kind: 'merge', notebook: selected })
                          })()
                        },
                      },
                      {
                        label: t('panel.backup'),
                        onSelect: () => {
                          void (async () => {
                            if (!(await ensureEditableSaved(selected.id))) return
                            await backupNotebook(selected)
                          })()
                        },
                      },
                      {
                        label: t('panel.delete'),
                        danger: true,
                        onSelect: () => {
                          void (async () => {
                            if (!requireCompatible()) return
                            if (!(await ensureEditableSaved(selected.id))) return
                            setDialog({ kind: 'delete', notebook: selected })
                          })()
                        },
                      },
                    ],
                  })),
                h('p', { className: 'dsn-detailMeta', key: 'meta' },
                  t('panel.entryCount', { count: selected.entries.length }),
                  ' · ',
                  t('panel.createdAt', { date: formatDateTime(selected.createdAt) }))),
              h('div', { className: 'dsn-detailActions', key: 'actions' },
                selectMode
                  ? h('button', {
                    type: 'button',
                    className: 'dsn-btn',
                    key: 'cancel',
                    onClick: () => {
                      setSelectMode(false)
                      setSelectedIds([])
                    },
                  }, t('panel.cancelSelection'))
                  : h('button', {
                    type: 'button',
                    className: 'dsn-btn',
                    key: 'new',
                    disabled: !compatible || editing !== null,
                    onClick: () => { void createNote() },
                  }, h(IconPlus, { key: 'icon' }), h('span', { key: 'text' }, t('panel.newNote'))),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn',
                  key: 'select',
                  disabled: !selectMode && displayEntries.length === 0,
                  onClick: () => {
                    void (async () => {
                      if (!selectMode) {
                        if (editing !== null) {
                          const ok = await finishEdit()
                          if (!ok) return
                        }
                        setSelectMode(true)
                        setSelectedIds([])
                      } else {
                        setSelectMode(false)
                        setSelectedIds([])
                      }
                    })()
                  },
                }, t(selectMode ? 'panel.cancelSelection' : 'panel.select')),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn',
                  key: 'export',
                  disabled: !compatible,
                  onClick: () => {
                    if (selectMode && selectedIds.length > 0) exportSelected()
                    else void exportNotebook(selected)
                  },
                }, h(IconDownload, { key: 'icon' }), h('span', { key: 'text' }, selectMode && selectedIds.length > 0
                  ? t('panel.exportSelected')
                  : hasImages ? t('panel.exportArchive') : t('panel.export'))))),
            (notebookTags.length > 0 || notebookWorkspaces.length > 0 || notebookSessions.length > 0)
              ? h('div', { className: 'dsn-filters', key: 'filters' },
                notebookTags.length > 0
                  ? h('button', {
                    type: 'button',
                    className: `dsn-chip${tagFilter === '' ? ' dsn-chipActive' : ''}`,
                    onClick: () => setTagFilter(''),
                  }, t('panel.tagAll'))
                  : null,
                notebookTags.map((tag) => h('button', {
                  key: `tag-${tag}`,
                  type: 'button',
                  className: `dsn-chip${tagFilter === tag ? ' dsn-chipActive' : ''}`,
                  onClick: () => setTagFilter(tagFilter === tag ? '' : tag),
                }, tag)),
                notebookWorkspaces.length > 0
                  ? h('select', {
                    className: 'dsn-select',
                    value: workspaceFilter,
                    'aria-label': t('panel.workspaceAll'),
                    onChange: (event) => setWorkspaceFilter(event.target.value),
                  },
                  h('option', { value: '' }, t('panel.workspaceAll')),
                  notebookWorkspaces.map((workspace) => h('option', { key: workspace, value: workspace }, workspace)))
                  : null,
                notebookSessions.length > 0
                  ? h('select', {
                    className: 'dsn-select',
                    value: sessionFilter,
                    'aria-label': t('panel.sessionAll'),
                    onChange: (event) => setSessionFilter(event.target.value),
                  },
                  h('option', { value: '' }, t('panel.sessionAll')),
                  notebookSessions.map((session) => h('option', { key: session.id, value: session.id }, session.title)))
                  : null)
              : null,
            selectMode
              ? h('div', { className: 'dsn-selectionBar', key: 'selection' },
                h('span', { className: 'dsn-selectionCount', key: 'count' }, t('panel.selectedCount', { count: selectedIds.length })),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn dsn-btnSmall',
                  onClick: () => setSelectedIds(allSelected ? [] : displayEntries.map((entry) => entry.id)),
                }, t(allSelected ? 'panel.selectNone' : 'panel.selectAll')),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn dsn-btnSmall',
                  disabled: selectedIds.length === 0,
                  onClick: () => setDialog({ kind: 'move', notebook: selected }),
                }, t('panel.moveSelected')),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn dsn-btnSmall',
                  disabled: selectedIds.length === 0,
                  onClick: () => { exportSelected() },
                }, t('panel.exportSelected')),
                h('button', {
                  type: 'button',
                  className: 'dsn-btn dsn-btnSmall dsn-btnDanger',
                  disabled: selectedIds.length === 0,
                  onClick: () => { void deleteSelected() },
                }, t('panel.deleteSelected')))
              : null,
            selected.entries.length === 0
              ? h('p', { className: 'dsn-hint', key: 'empty' }, t('panel.entriesEmpty'))
              : displayEntries.length === 0
                ? h('p', { className: 'dsn-hint', key: 'filtered' }, t('panel.searchEmpty'))
                : h('ol', { className: 'dsn-entries', key: 'entries' }, displayEntries.map((entry) => renderEntry(selected, entry))))
          }

          const viewerNode = viewer === null ? null : h('div', {
            className: 'dsn-viewer',
            onClick: (event) => {
              if (event.target === event.currentTarget) setViewer(null)
            },
          },
          h('div', { className: 'dsn-viewerPanel' },
            h('div', { className: 'dsn-viewerHead' },
              h('span', { className: 'dsn-viewerCaption' }, viewer.caption || viewer.name),
              h('button', {
                type: 'button',
                className: 'dsn-viewerBtn',
                onClick: () => setViewer(null),
              }, t('panel.close'))),
            h('div', { className: 'dsn-viewerBody' },
              h('img', {
                src: imageUrl(viewer),
                alt: viewer.caption || viewer.name,
                style: { transform: `scale(${viewerZoom})`, maxWidth: '100%' },
              })),
            h('div', { className: 'dsn-viewerBar' },
              h('button', {
                type: 'button',
                className: 'dsn-viewerBtn',
                'aria-label': t('panel.zoomOut'),
                onClick: () => setViewerZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2)))),
              }, '−'),
              h('button', {
                type: 'button',
                className: 'dsn-viewerBtn',
                onClick: () => setViewerZoom(1),
              }, `${Math.round(viewerZoom * 100)}%`),
              h('button', {
                type: 'button',
                className: 'dsn-viewerBtn',
                'aria-label': t('panel.zoomIn'),
                onClick: () => setViewerZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2)))),
              }, '+'))))

          return h('section', { className: 'dsn-page', 'aria-label': t('panel.title') },
            h('header', { className: 'dsn-head', key: 'head' },
              h('div', { className: 'dsn-headText', key: 'text' },
                h('h1', { className: 'dsn-headTitle', key: 'title' }, t('panel.title')),
                h('p', { className: 'dsn-headIntro', key: 'intro' }, t('panel.intro')),
                snapshot.phase === 'ready' && !compatible
                  ? h('p', { className: 'dsn-banner', key: 'banner' }, t('panel.versionMismatch', { host: snapshot.apiVersion === null ? '?' : snapshot.apiVersion }))
                  : null),
              h('div', { className: 'dsn-headActions', key: 'actions' },
                h('button', {
                  type: 'button',
                  className: 'dsn-btn dsn-btnPrimary',
                  key: 'new',
                  disabled: !compatible,
                  onClick: () => setDialog({ kind: 'create' }),
                }, h(IconPlus, { key: 'icon' }), h('span', { key: 'text' }, t('panel.new'))),
                h(MoreMenu, {
                  key: 'more',
                  label: t('panel.more'),
                  items: [
                    {
                      label: t('panel.backupAll'),
                      onSelect: () => {
                        void (async () => {
                          if (!requireCompatible()) return
                          if (editing !== null) {
                            const ok = await finishEdit()
                            if (!ok) return
                          }
                          await backupNotebook(null)
                        })()
                      },
                    },
                    {
                      label: importing ? t('panel.importing') : t('panel.import'),
                      onSelect: () => {
                        if (!requireCompatible()) return
                        if (importInputRef.current !== null) importInputRef.current.click()
                      },
                    },
                    { label: `${t('panel.trash')} (${trashCount})`, onSelect: () => setDialog({ kind: 'trash' }) },
                  ],
                }),
                h('input', {
                  ref: importInputRef,
                  type: 'file',
                  accept: '.json,.zip,.md,.markdown,.txt',
                  style: { display: 'none' },
                  onChange: (event) => {
                    const file = event.target.files && event.target.files[0]
                    event.target.value = ''
                    if (file) void handleImportFile(file)
                  },
                }))),
            h('div', { className: 'dsn-bodyWrap', key: 'body' },
              h('div', { className: 'dsn-body' }, renderSide(), renderDetail())),
            dialog && dialog.kind === 'create'
              ? h(CreateDialog, { key: 'create', onClose: () => setDialog(null) })
              : null,
            dialog && dialog.kind === 'rename'
              ? h(RenameDialog, { key: 'rename', notebook: dialog.notebook, onClose: () => setDialog(null) })
              : null,
            dialog && dialog.kind === 'delete'
              ? h(DeleteDialog, {
                key: 'delete',
                notebook: dialog.notebook,
                onClose: () => setDialog(null),
                onDeleted: (payload) => {
                  toasts.show(t('toast.deleted', { name: dialog.notebook.name }), payload && payload.trashId
                    ? { kind: 'restore', trashId: payload.trashId }
                    : null)
                },
              })
              : null,
            dialog && dialog.kind === 'trash'
              ? h(TrashDialog, { key: 'trash', snapshot, onClose: () => setDialog(null) })
              : null,
            dialog && dialog.kind === 'merge'
              ? h(NotebookPickerDialog, {
                key: 'merge',
                title: t('panel.mergeTitle'),
                hint: t('panel.mergeHint'),
                notebook: dialog.notebook,
                notebooks,
                excludeId: dialog.notebook.id,
                onClose: () => setDialog(null),
                onPick: (target) => {
                  setDialog(null)
                  void store.mergeNotebook(dialog.notebook.id, target.id)
                    .then(() => toasts.show(t('panel.mergeDone', { name: target.name })))
                    .catch((error) => toasts.show(describeError(error)))
                },
              })
              : null,
            dialog && dialog.kind === 'move'
              ? h(NotebookPickerDialog, {
                key: 'move',
                title: t('panel.moveTitle'),
                notebook: dialog.notebook,
                notebooks,
                excludeId: dialog.notebook.id,
                onClose: () => setDialog(null),
                onPick: (target) => {
                  const count = selectedIds.length
                  setDialog(null)
                  void store.moveEntries(dialog.notebook.id, selectedIds, target.id)
                    .then(() => {
                      toasts.show(t('panel.moved', { count }))
                      setSelectedIds([])
                      setSelectMode(false)
                    })
                    .catch((error) => toasts.show(describeError(error)))
                },
              })
              : null,
            dialog && dialog.kind === 'urlImage'
              ? h(UrlImageDialog, {
                key: 'urlImage',
                onClose: () => setDialog(null),
                onAdd: (image) => {
                  addFetchedImage(image)
                  setDialog(null)
                },
              })
              : null,
            viewerNode)
        }

        /* ------------------------------- dialogs -------------------------------- */

        function CreateDialog (props) {
          useLocaleRevision()
          const [name, setName] = useState(() => t('panel.defaultName'))
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const submit = async () => {
            const trimmed = name.trim()
            if (trimmed === '') {
              setError(t('error.name'))
              return
            }
            setBusy(true)
            setError(null)
            try {
              const payload = await store.create(trimmed)
              toasts.show(t('toast.createdEmpty', { name: payload.name || trimmed }), payload.createdId ? { kind: 'view', notebookId: payload.createdId } : null)
              props.onClose()
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          return h(Modal, { title: t('panel.newTitle'), onClose: props.onClose },
            h('form', {
              className: 'dsn-field',
              onSubmit: (event) => {
                event.preventDefault()
                void submit()
              },
            },
            h('label', { className: 'dsn-label', htmlFor: 'dsn-new-name' }, t('panel.nameLabel')),
            h('input', {
              id: 'dsn-new-name',
              className: 'dsn-input',
              type: 'text',
              value: name,
              maxLength: 120,
              autoFocus: true,
              placeholder: t('panel.namePlaceholder'),
              onChange: (event) => { setName(event.target.value) },
            }),
            error ? h('p', { className: 'dsn-errorText' }, error) : null,
            h('div', { className: 'dsn-modalActions' },
              h('button', {
                type: 'button',
                className: 'dsn-btn',
                disabled: busy,
                onClick: props.onClose,
              }, t('panel.cancel')),
              h('button', {
                type: 'submit',
                className: 'dsn-btn dsn-btnPrimary',
                disabled: busy,
              }, busy ? t('panel.saving') : t('panel.create')))))
        }

        function RenameDialog (props) {
          useLocaleRevision()
          const [name, setName] = useState(() => props.notebook.name)
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const submit = async () => {
            const trimmed = name.trim()
            if (trimmed === '') {
              setError(t('error.name'))
              return
            }
            setBusy(true)
            setError(null)
            try {
              const payload = await store.rename(props.notebook.id, trimmed)
              toasts.show(t('toast.renamed', { name: payload.name || trimmed }), { kind: 'view', notebookId: props.notebook.id })
              props.onClose()
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          return h(Modal, { title: t('panel.renameTitle'), onClose: props.onClose },
            h('form', {
              className: 'dsn-field',
              onSubmit: (event) => {
                event.preventDefault()
                void submit()
              },
            },
            h('label', { className: 'dsn-label', htmlFor: 'dsn-rename-name' }, t('panel.nameLabel')),
            h('input', {
              id: 'dsn-rename-name',
              className: 'dsn-input',
              type: 'text',
              value: name,
              maxLength: 120,
              autoFocus: true,
              placeholder: t('panel.namePlaceholder'),
              onChange: (event) => { setName(event.target.value) },
            }),
            error ? h('p', { className: 'dsn-errorText' }, error) : null,
            h('div', { className: 'dsn-modalActions' },
              h('button', {
                type: 'button',
                className: 'dsn-btn',
                disabled: busy,
                onClick: props.onClose,
              }, t('panel.cancel')),
              h('button', {
                type: 'submit',
                className: 'dsn-btn dsn-btnPrimary',
                disabled: busy,
              }, busy ? t('panel.saving') : t('panel.rename')))))
        }

        function DeleteDialog (props) {
          useLocaleRevision()
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const notebook = props.notebook
          const confirm = async () => {
            setBusy(true)
            setError(null)
            try {
              const payload = await store.remove(notebook.id)
              props.onDeleted(payload)
              props.onClose()
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          return h(Modal, { title: t('panel.deleteTitle'), onClose: props.onClose },
            h('p', { className: 'dsn-modalText' },
              t('panel.deleteBody', { name: notebook.name, count: notebook.entries.length })),
            error ? h('p', { className: 'dsn-errorText' }, error) : null,
            h('div', { className: 'dsn-modalActions' },
              h('button', {
                type: 'button',
                className: 'dsn-btn',
                disabled: busy,
                autoFocus: true,
                onClick: props.onClose,
              }, t('panel.cancel')),
              h('button', {
                type: 'button',
                className: 'dsn-btn dsn-btnDanger dsn-btnSolid',
                disabled: busy,
                onClick: () => { void confirm() },
              }, busy ? t('panel.deleting') : t('panel.deleteConfirm'))))
        }

        function TrashDialog (props) {
          useLocaleRevision()
          const snapshot = props.snapshot
          const [busy, setBusy] = useState('')
          const [error, setError] = useState(null)
          const run = async (key, action) => {
            setBusy(key)
            setError(null)
            try {
              await action()
            } catch (failure) {
              setError(describeError(failure))
            } finally {
              setBusy('')
            }
          }
          return h(Modal, { title: t('panel.trashTitle'), onClose: props.onClose, wide: true },
            h('p', { className: 'dsn-modalText' }, t('panel.trashHint')),
            error ? h('p', { className: 'dsn-errorText' }, error) : null,
            snapshot.trash.length === 0
              ? h('p', { className: 'dsn-hint' }, t('panel.trashEmpty'))
              : h('div', { className: 'dsn-pickList' }, snapshot.trash.map((item) => h('div', { className: 'dsn-trashRow', key: item.id },
                h('div', { className: 'dsn-trashMain' },
                  h('span', { className: 'dsn-trashTitle' }, item.kind === 'notebook' ? item.notebookName : `${item.notebookName} · ${t('panel.deleteNote')}`),
                  h('span', { className: 'dsn-trashMeta' }, `${item.preview || ''} ${item.preview ? '·' : ''} ${t('panel.deletedAt', { date: formatDateTime(item.deletedAt) })}`)),
                h('div', { className: 'dsn-trashActions' },
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btnSmall',
                    disabled: busy !== '',
                    onClick: () => {
                      void run(item.id, async () => {
                        const payload = await store.restoreTrash(item.id)
                        toasts.show(t('panel.restored', { name: payload.name || item.notebookName }))
                      })
                    },
                  }, t('panel.trashRestore')),
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btnSmall dsn-btnDanger',
                    disabled: busy !== '',
                    onClick: () => {
                      void run(`${item.id}-purge`, () => store.purgeTrash(item.id))
                    },
                  }, t('panel.trashPurge')))))),
            h('div', { className: 'dsn-modalActions' },
              h('button', {
                type: 'button',
                className: 'dsn-btn dsn-btnDanger',
                disabled: busy !== '' || snapshot.trash.length === 0,
                onClick: () => { void run('empty', () => store.emptyTrash()) },
              }, t('panel.trashEmptyAll')),
              h('button', {
                type: 'button',
                className: 'dsn-btn',
                onClick: props.onClose,
              }, t('panel.close'))))
        }

        function UrlImageDialog (props) {
          useLocaleRevision()
          const [url, setUrl] = useState('')
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const submit = async () => {
            const value = url.trim()
            if (!/^https?:\/\//iu.test(value)) {
              setError(t('error.url'))
              return
            }
            setBusy(true)
            setError(null)
            try {
              const image = await store.fetchImage(value)
              props.onAdd(image)
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          return h(Modal, { title: t('panel.imageUrlTitle'), onClose: props.onClose },
            h('form', {
              className: 'dsn-field',
              onSubmit: (event) => {
                event.preventDefault()
                void submit()
              },
            },
            h('label', { className: 'dsn-label', htmlFor: 'dsn-image-url' }, t('panel.imageUrlPlaceholder')),
            h('input', {
              id: 'dsn-image-url',
              className: 'dsn-input',
              type: 'url',
              value: url,
              autoFocus: true,
              placeholder: t('panel.imageUrlPlaceholder'),
              onChange: (event) => setUrl(event.target.value),
            }),
            h('p', { className: 'dsn-hint' }, t('panel.imageUrlHint')),
            error ? h('p', { className: 'dsn-errorText' }, error) : null,
            h('div', { className: 'dsn-modalActions' },
              h('button', {
                type: 'button',
                className: 'dsn-btn',
                disabled: busy,
                onClick: props.onClose,
              }, t('panel.cancel')),
              h('button', {
                type: 'submit',
                className: 'dsn-btn dsn-btnPrimary',
                disabled: busy,
              }, busy ? t('panel.fetchingImage') : t('panel.imageUrlFetch')))))
        }

        function QuickSurface (props) {
          useLocaleRevision()
          const readText = typeof props.readText === 'function' ? props.readText : () => null
          const dismiss = typeof props.dismiss === 'function' ? props.dismiss : () => {}
          const clearSelection = typeof props.clearSelection === 'function' ? props.clearSelection : () => {}
          const [text] = useState(() => {
            try {
              const value = readText()
              return typeof value === 'string' ? value : ''
            } catch {
              return ''
            }
          })
          const snapshot = useExternal(store.subscribe, store.getSnapshot)
          const [view, setView] = useState('menu')
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const [customName, setCustomName] = useState(null)
          const sessionId = props.sessionId
          const sessionTitle = props.useSessions((state) => (
            state && state.byId && sessionId && state.byId[sessionId] ? state.byId[sessionId].displayTitle : ''
          ))
          const workspaces = props.useWorkspaces((state) => state)
          const workspace = workspaces && Array.isArray(workspaces.items)
            ? workspaces.items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
            : undefined
          const workspaceTitle = workspace && typeof workspace.title === 'string' ? workspace.title : ''
          const suggestedName = [workspaceTitle, sessionTitle]
            .filter((part) => typeof part === 'string' && part.trim() !== '')
            .join('-')
            .slice(0, 120)
          const name = customName === null ? (suggestedName || t('panel.defaultName')) : customName
          useEffect(() => {
            if (text.trim() === '') dismiss()
          }, [])
          const source = () => ({
            sessionId: typeof sessionId === 'string' ? sessionId : '',
            sessionTitle: typeof sessionTitle === 'string' ? sessionTitle : '',
            workspace: workspaceTitle,
          })
          const guard = () => {
            const state = store.getSnapshot()
            if (state.phase !== 'ready') {
              setError(t('panel.loading'))
              return false
            }
            if (!state.compatible) {
              setError(t('error.version'))
              return false
            }
            return true
          }
          const appendTo = async (notebook) => {
            if (!guard()) return
            setBusy(true)
            setError(null)
            try {
              await store.append(notebook.id, text, source())
              toasts.show(t('toast.written', { name: notebook.name }), { kind: 'view', notebookId: notebook.id })
              clearSelection()
              dismiss()
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          const createAndSave = async () => {
            const trimmed = name.trim()
            if (trimmed === '') {
              setError(t('error.name'))
              return
            }
            if (!guard()) return
            setBusy(true)
            setError(null)
            try {
              const payload = await store.create(trimmed, text, source())
              toasts.show(t('toast.created', { name: payload.name || trimmed }), { kind: 'view', notebookId: payload.createdId })
              clearSelection()
              dismiss()
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          if (text.trim() === '') return null
          const preview = h('p', { className: 'dsn-preview', key: 'preview', title: text }, text.trim())
          if (view === 'create') {
            return h('div', { className: 'dsn-surface', role: 'group', 'aria-label': t('surface.createTitle') },
              h('div', { className: 'dsn-surfaceHead', key: 'head' },
                h('button', {
                  type: 'button',
                  className: 'dsn-iconBtn',
                  'aria-label': t('surface.back'),
                  onClick: () => setView('menu'),
                }, h(IconBack)),
                h('span', { className: 'dsn-surfaceTitle', key: 'title' }, t('surface.createTitle'))),
              h('p', { className: 'dsn-preview', key: 'hint' }, t('surface.createHint')),
              h('form', {
                className: 'dsn-createForm',
                key: 'form',
                onSubmit: (event) => {
                  event.preventDefault()
                  void createAndSave()
                },
              },
              h('label', { className: 'dsn-label', htmlFor: 'dsn-surface-name' }, t('surface.nameLabel')),
              h('input', {
                id: 'dsn-surface-name',
                className: 'dsn-input',
                type: 'text',
                value: name,
                maxLength: 120,
                autoFocus: true,
                placeholder: t('surface.namePlaceholder'),
                onChange: (event) => setCustomName(event.target.value),
              }),
              error ? h('p', { className: 'dsn-errorText', key: 'error' }, error) : null,
              h('button', {
                type: 'submit',
                className: 'dsn-btn dsn-btnPrimary dsn-btnBlock',
                key: 'submit',
                disabled: busy,
              }, busy ? t('surface.saving') : t('surface.createAndWrite'))))
          }
          if (view === 'pick') {
            const surfaceNotebooks = snapshot.notebooks
            return h('div', { className: 'dsn-surface', role: 'group', 'aria-label': t('surface.pickTitle') },
              h('div', { className: 'dsn-surfaceHead', key: 'head' },
                h('button', {
                  type: 'button',
                  className: 'dsn-iconBtn',
                  'aria-label': t('surface.back'),
                  onClick: () => setView('menu'),
                }, h(IconBack)),
                h('span', { className: 'dsn-surfaceTitle', key: 'title' }, t('surface.pickTitle'))),
              preview,
              snapshot.phase === 'error'
                ? h('div', { className: 'dsn-error', key: 'error' },
                  h('p', null, describeSnapshotError(snapshot)),
                  h('button', {
                    type: 'button',
                    className: 'dsn-btn',
                    onClick: () => { store.load() },
                  }, t('panel.retry')))
                : null,
              snapshot.phase === 'loading' && surfaceNotebooks.length === 0
                ? h('p', { className: 'dsn-hint', key: 'loading' }, t('panel.loading'))
                : null,
              surfaceNotebooks.length > 0
                ? h('div', { className: 'dsn-pickList', key: 'list' }, surfaceNotebooks.map((notebook) => h('button', {
                  type: 'button',
                  className: 'dsn-pickItem',
                  key: notebook.id,
                  disabled: busy,
                  onClick: () => { void appendTo(notebook) },
                },
                h('span', { className: 'dsn-pickName', key: 'name' }, notebook.name),
                h('span', { className: 'dsn-pickCount', key: 'count' }, notebook.entries.length))))
                : null,
              error ? h('p', { className: 'dsn-errorText', key: 'writeError' }, error) : null,
              busy ? h('p', { className: 'dsn-hint', key: 'busy' }, t('surface.saving')) : null,
              h('button', {
                type: 'button',
                className: 'dsn-pickNew',
                key: 'new',
                disabled: busy,
                onClick: () => { setError(null); setView('create') },
              }, h(IconPlus, { key: 'icon' }), h('span', { key: 'text' }, t('surface.newNotebook'))))
          }
          return h('div', { className: 'dsn-surface', role: 'group', 'aria-label': t('surface.title') },
            preview,
            h('button', {
              type: 'button',
              className: 'dsn-menuItem',
              key: 'write',
              onClick: () => {
                setError(null)
                setView('pick')
                if (store.getSnapshot().phase === 'error') store.load()
              },
            }, h(NotebookGlyph, { key: 'icon', size: 15 }), h('span', { key: 'text' }, t('surface.write'))),
            h('button', {
              type: 'button',
              className: 'dsn-menuItem',
              key: 'create',
              onClick: () => { setError(null); setView('create') },
            }, h(IconPlus, { key: 'icon' }), h('span', { key: 'text' }, t('surface.create'))))
        }

        function MessageNotebookAction (props) {
          useLocaleRevision()
          const snapshot = useExternal(store.subscribe, store.getSnapshot)
          const [open, setOpen] = useState(false)
          const [view, setView] = useState('pick')
          const [busy, setBusy] = useState(false)
          const [error, setError] = useState(null)
          const [customName, setCustomName] = useState(null)
          const sessionId = props.sessionId
          const messageText = props.useChat((chat) => {
            if (!chat || !chat.nodes || typeof chat.nodes.values !== 'function') return ''
            for (const node of chat.nodes.values()) {
              if (!node || node.kind !== 'assistant-step' || !node.data) continue
              const finalNode = node.data.finalNode
              if (!finalNode || finalNode.messageId !== props.messageId) continue
              const blocks = Array.isArray(node.data.blocks) ? node.data.blocks : []
              return blocks
                .filter((block) => block && block.kind === 'text' && typeof block.text === 'string')
                .map((block) => block.text)
                .join('\n\n')
                .trim()
            }
            return ''
          })
          const sessionTitle = props.useSessions((state) => (
            state && state.byId && sessionId && state.byId[sessionId] ? state.byId[sessionId].displayTitle : ''
          ))
          const workspaces = props.useWorkspaces((state) => state)
          const workspace = workspaces && Array.isArray(workspaces.items)
            ? workspaces.items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
            : undefined
          const workspaceTitle = workspace && typeof workspace.title === 'string' ? workspace.title : ''
          const suggestedName = [workspaceTitle, sessionTitle]
            .filter((part) => typeof part === 'string' && part.trim() !== '')
            .join('-')
            .slice(0, 120)
          const name = customName === null ? (suggestedName || t('panel.defaultName')) : customName
          const versionBlocked = snapshot.phase === 'ready' && !snapshot.compatible
          const notReady = snapshot.phase !== 'ready' || versionBlocked
          if (messageText === '') return null
          const source = () => ({
            sessionId: typeof sessionId === 'string' ? sessionId : '',
            sessionTitle: typeof sessionTitle === 'string' ? sessionTitle : '',
            workspace: workspaceTitle,
          })
          const appendTo = async (notebook) => {
            setBusy(true)
            setError(null)
            try {
              await store.append(notebook.id, messageText, source())
              toasts.show(t('toast.written', { name: notebook.name }), { kind: 'view', notebookId: notebook.id })
              setOpen(false)
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          const createAndSave = async () => {
            const trimmed = name.trim()
            if (trimmed === '') {
              setError(t('error.name'))
              return
            }
            setBusy(true)
            setError(null)
            try {
              const payload = await store.create(trimmed, messageText, source())
              toasts.show(t('toast.created', { name: payload.name || trimmed }), { kind: 'view', notebookId: payload.createdId })
              setOpen(false)
            } catch (failure) {
              setError(describeError(failure))
              setBusy(false)
            }
          }
          return h(React.Fragment, null,
            h('button', {
              type: 'button',
              className: 'dsn-msgAction',
              'aria-label': t('msg.title'),
              title: t('msg.title'),
              onClick: () => {
                setOpen(true)
                setView('pick')
                setError(null)
                if (store.getSnapshot().phase === 'error') store.load()
              },
            }, h(NotebookGlyph, { size: 14 })),
            open
              ? h(Modal, { title: t('msg.title'), onClose: () => setOpen(false) },
                h('p', { className: 'dsn-modalText' }, t('msg.hint')),
                versionBlocked
                  ? h('p', { className: 'dsn-errorText' }, t('error.version'))
                  : null,
                view === 'create'
                  ? h('form', {
                    className: 'dsn-field',
                    onSubmit: (event) => {
                      event.preventDefault()
                      void createAndSave()
                    },
                  },
                  h('label', { className: 'dsn-label', htmlFor: 'dsn-msg-name' }, t('msg.nameLabel')),
                  h('input', {
                    id: 'dsn-msg-name',
                    className: 'dsn-input',
                    type: 'text',
                    value: name,
                    maxLength: 120,
                    autoFocus: true,
                    onChange: (event) => setCustomName(event.target.value),
                  }),
                  error ? h('p', { className: 'dsn-errorText' }, error) : null,
                  h('div', { className: 'dsn-modalActions' },
                    h('button', {
                      type: 'button',
                      className: 'dsn-btn',
                      disabled: busy,
                      onClick: () => setView('pick'),
                    }, t('surface.back')),
                    h('button', {
                      type: 'submit',
                      className: 'dsn-btn dsn-btnPrimary',
                      disabled: busy || notReady,
                    }, busy ? t('surface.saving') : t('msg.createAndWrite'))))
                  : h(React.Fragment, null,
                    snapshot.phase === 'loading' && snapshot.notebooks.length === 0
                      ? h('p', { className: 'dsn-hint' }, t('panel.loading'))
                      : null,
                    snapshot.notebooks.length === 0
                      ? h('p', { className: 'dsn-hint' }, t('panel.emptyHint'))
                      : h('div', { className: 'dsn-pickList' }, snapshot.notebooks.map((notebook) => h('button', {
                        key: notebook.id,
                        type: 'button',
                        className: 'dsn-pickItem',
                        disabled: busy || notReady,
                        onClick: () => { void appendTo(notebook) },
                      },
                      h('span', { className: 'dsn-pickName', key: 'name' }, notebook.name),
                      h('span', { className: 'dsn-pickMeta', key: 'meta' }, t('panel.entryCount', { count: notebook.entries.length }))))),
                    error ? h('p', { className: 'dsn-errorText' }, error) : null,
                    h('div', { className: 'dsn-modalActions' },
                      h('button', {
                        type: 'button',
                        className: 'dsn-btn',
                        disabled: busy || notReady,
                        onClick: () => setView('create'),
                      }, t('surface.newNotebook')))))
              : null)
        }

        function ToastHost () {
          useLocaleRevision()
          const toast = useExternal(toasts.subscribe, toasts.getSnapshot)
          const current = toast
          useEffect(() => {
            if (current === null) return undefined
            const timer = setTimeout(() => toasts.dismiss(current.token), TOAST_MS)
            return () => clearTimeout(timer)
          }, [current === null ? 0 : current.token])
          if (current === null) return null
          const action = current.action
          const onAction = async () => {
            if (!action) return
            if (action.kind === 'view') {
              store.select(action.notebookId)
              ctx.layout.selectPanel('notebook')
              toasts.dismiss(current.token)
              return
            }
            if (action.kind === 'restore') {
              try {
                const payload = await store.restoreTrash(action.trashId)
                toasts.show(t('toast.restored', { name: payload.name || '' }))
              } catch (error) {
                toasts.show(describeError(error))
              }
            }
          }
          return h('div', { className: 'dsn-toastLayer' },
            h('div', { className: 'dsn-toast', role: 'status', 'aria-live': 'polite' },
              h('span', { className: 'dsn-toastText', key: 'text', title: current.message }, current.message),
              action
                ? h('button', {
                  type: 'button',
                  className: 'dsn-toastAction',
                  key: 'action',
                  onClick: () => { void onAction() },
                }, action.kind === 'restore' ? t('toast.undo') : t('toast.view'))
                : null,
              h('button', {
                type: 'button',
                className: 'dsn-toastClose',
                key: 'close',
                'aria-label': t('toast.dismiss'),
                onClick: () => { toasts.dismiss(current.token) },
              }, '×')))
        }

        /* ----------------------------- registration ----------------------------- */

        const conversation = ctx.get('uiConversation')
        if (conversation && conversation.interactions && typeof conversation.interactions.register === 'function') {
          ctx.effect(() => conversation.interactions.register({
            id: 'notebook',
            onInteraction (request) {
              if (request.trigger !== 'contextmenu') return
              let text = null
              try {
                text = request.readText()
              } catch {
                text = null
              }
              if (typeof text !== 'string' || text.trim() === '') return
              if (typeof request.preventDefault === 'function') request.preventDefault()
              request.open()
            },
          }), 'dshnotebook: text interaction')
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'notebook',
          order: 20,
          label: () => t('panel.label'),
        }, NotebookGlyph))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'notebook',
        }, NotebookPanel))

        ctx.slots.inject('conversation.chat.text-interaction', () => ctx.slots.register({
          name: 'conversation.chat.text-interaction',
          key: 'notebook',
        }, QuickSurface))

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'dshnotebook-message',
          order: 20,
        }, MessageNotebookAction))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dshnotebook-toast',
          order: 50,
        }, ToastHost))

        store.load()
      },
    }
  },
})
