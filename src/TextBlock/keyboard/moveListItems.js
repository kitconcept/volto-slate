import { Editor, Path, Transforms, Node } from 'slate';
import { isCursorInList } from 'volto-slate/utils';
import { settings } from '~/config';

export function moveListItemUp({ editor, event }) {
  if (!(event.ctrlKey && isCursorInList(editor))) return;
  const { anchor } = editor.selection;
  const { slate } = settings;

  // TODO: this will need reimplementation when we have sublists

  // don't allow in first line list item
  if (anchor.path.slice(1).reduce((acc, n) => acc + n, 0) === 0) return;

  const [match] = Editor.nodes(editor, {
    match: (n) => n.type === slate.listItemType,
  });

  const path = match[1];

  Transforms.moveNodes(editor, {
    to: Path.previous(path),
  });

  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function moveListItemDown({ editor, event }) {
  if (!event.ctrlKey) return;
  if (!isCursorInList(editor)) return false;

  const { slate } = settings;

  const [match] = Editor.nodes(editor, {
    match: (n) => n.type === slate.listItemType,
  });

  const path = match[1];
  const parentPath = Path.parent(path);
  const pathToLast = Node.last(editor, parentPath)[1];
  if (Path.isCommon(path, pathToLast)) return;

  Transforms.moveNodes(editor, {
    to: Path.next(path),
  });

  event.preventDefault();
  event.stopPropagation();
  return true;
}