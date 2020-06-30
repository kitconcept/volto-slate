import { Editor, Path, Point, Range, Transforms, Text, Node } from 'slate';
import { castArray } from 'lodash';
import {
  simulateBackspaceAtEndOfEditor,
  createDefaultFragment,
  createAndSelectNewSlateBlock,
  splitEditorInTwoFragments,
  replaceAllContentInEditorWith,
} from '../utils';

/**
 * See {@link Range.isCollapsed}.
 * Return false if `range` is not defined.
 */
const isCollapsed = (range) => !!range && Range.isCollapsed(range);

/**
 * When deleting backward at the start of an empty block, reset the block type to a default type.
 */
const withDeleteStartReset = ({
  defaultType = 'paragraph',
  types,
  onUnwrap,
}) => (editor) => {
  const { deleteBackward } = editor;

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (isCollapsed(selection)) {
      const parent = Editor.above(editor, {
        match: (n) => types.includes(n.type),
      });

      if (parent) {
        const [, parentPath] = parent;
        const parentStart = Editor.start(editor, parentPath);

        if (selection && Point.equals(selection.anchor, parentStart)) {
          Transforms.setNodes(editor, { type: defaultType });

          if (onUnwrap) {
            onUnwrap();
          }

          return;
        }
      }
    }

    deleteBackward(...args);
  };

  return editor;
};

const isPointAtRoot = (point) => point.path.length === 2;

const isRangeAtRoot = (range) =>
  isPointAtRoot(range.anchor) || isPointAtRoot(range.focus);

const unwrapNodesByType = (editor, types, options = {}) => {
  types = castArray(types);

  Transforms.unwrapNodes(editor, {
    match: (n) => types.includes(n.type),
    ...options,
  });
};

/**
 * Get the block above the selection. If not found, return the editor entry.
 */
const getBlockAboveSelection = (editor) =>
  Editor.above(editor, {
    match: (n) => Editor.isBlock(editor, n),
  }) || [editor, []];

/**
 * Has the node an empty text
 * TODO: try Node.string
 */
const isBlockTextEmpty = (node) => {
  const lastChild = node.children[node.children.length - 1];

  return Text.isText(lastChild) && !lastChild.text.length;
};

/**
 * When inserting break at the start of an empty block, reset the block type to a default type.
 */
const withBreakEmptyReset = ({
  types,
  defaultType = 'paragraph',
  onUnwrap,
}) => (editor) => {
  const { insertBreak } = editor;

  editor.insertBreak = () => {
    const blockEntry = getBlockAboveSelection(editor);

    const [block] = blockEntry;

    if (isBlockTextEmpty(block)) {
      const parent = Editor.above(editor, {
        match: (n) => types.includes(n.type),
      });

      if (parent) {
        Transforms.setNodes(editor, { type: defaultType });

        if (onUnwrap) {
          onUnwrap();
        }

        return;
      }
    }

    insertBreak();
  };

  return editor;
};

/**
 * Combine {@link withBreakEmptyReset} and {@link withDeleteStartReset}.
 */
const withResetBlockType = (options) => (editor) => {
  editor = withBreakEmptyReset(options)(editor);
  editor = withDeleteStartReset(options)(editor);

  return editor;
};

const thereIsNoListItemBelowSelection = (editor) => {
  let sel = editor.selection;
  if (Range.isExpanded(sel)) {
    Transforms.collapse(editor, { edge: 'start' });
  }
  // path of paragraph (TODO: what if there is no paragraph, but a nested list?)
  let pg = Path.parent(sel.anchor.path);
  // Path of list-item
  let p = Path.parent(pg);
  // Path of numbered/bulleted list
  let pp = Path.parent(p);

  let listItems = Node.children(editor, pp);

  for (let [node, path] of listItems) {
    if (Path.isAfter(path, p)) {
      return false;
    }
  }

  return true;
};

const withList = ({
  typeUl = 'bulleted-list',
  typeOl = 'numbered-list',
  typeLi = 'list-item',
  typeP = 'paragraph',
  onChangeBlock,
  onAddBlock,
  onSelectBlock,
  index,
} = {}) => (editor) => {
  const { insertBreak } = editor;

  const createAndSelectNewBlockAfter = (blockValue) => {
    return createAndSelectNewSlateBlock(blockValue, index, {
      onChangeBlock,
      onAddBlock,
      onSelectBlock,
    });
  };

  /**
   * Add a new list item if selection is in a LIST_ITEM > typeP.
   */
  editor.insertBreak = () => {
    // if there is a selection that touches the root
    if (editor.selection && !isRangeAtRoot(editor.selection)) {
      const [paragraphNode, paragraphPath] = Editor.parent(
        editor,
        editor.selection,
      );
      // if the selection is inside a paragraph
      if (paragraphNode.type === typeP) {
        const listItemEntry = Editor.parent(editor, paragraphPath);
        const [listItemNode, listItemPath] = listItemEntry;

        // if the paragraph is inside a list item
        if (listItemEntry && listItemNode.type === typeLi) {
          // if selection is expanded, delete it
          if (!Range.isCollapsed(editor.selection)) {
            Transforms.delete(editor);
          }

          const start = Editor.start(editor, paragraphPath);
          const end = Editor.end(editor, paragraphPath);

          const isStart = Point.equals(editor.selection.anchor, start);
          const isEnd = Point.equals(editor.selection.anchor, end);

          // console.log('isStart', isStart);

          /**
           * If cursor on start of paragraph, if the paragraph is empty, remove the paragraph (and the list item), then break the block!
           * if it is not empty, insert a new empty list item.
           */
          if (isStart) {
            if (isBlockTextEmpty(paragraphNode)) {
              if (thereIsNoListItemBelowSelection(editor)) {
                simulateBackspaceAtEndOfEditor(editor);
                const bottomBlockValue = createDefaultFragment();
                createAndSelectNewBlockAfter(bottomBlockValue);
                return;
              } else {
                console.log('should split the list in two Volto blocks!');
                let [upBlock, bottomBlock] = splitEditorInTwoFragments(editor);

                let [listNode, listPath] = Editor.parent(editor, listItemPath);

                let theType = listNode.type;

                let newUpBlock = [
                  {
                    type: theType,
                    children: upBlock[0].children.slice(
                      0,
                      upBlock[0].children.length - 1,
                    ),
                  },
                ];

                let newBottomBlock = [
                  {
                    type: theType,
                    children: bottomBlock[0].children.slice(
                      1,
                      bottomBlock[0].children.length,
                    ),
                  },
                ];

                console.log('newUpBlock', newUpBlock);
                // console.log('newBottomBlock', newBottomBlock);

                replaceAllContentInEditorWith(editor, newUpBlock);
                createAndSelectNewBlockAfter(newBottomBlock);

                return;
              }
            } else {
              console.log('inserting new list item');
              Transforms.insertNodes(
                editor,
                {
                  type: typeLi,
                  children: [{ type: typeP, children: [{ text: '' }] }],
                },
                { at: listItemPath },
              );
            }
          }

          console.log('isEnd', isEnd);
          const nextParagraphPath = Path.next(paragraphPath);
          const nextListItemPath = Path.next(listItemPath);
          /**
           * If not end, split nodes, wrap a list item on the new paragraph and move it to the next list item
           */
          if (!isEnd) {
            Transforms.splitNodes(editor, { at: editor.selection });

            // this condition is necessary to avoid a not understood bug
            if (Node.has(editor, nextParagraphPath)) {
              Transforms.wrapNodes(
                editor,
                {
                  type: typeLi,
                  children: [{ text: '' }],
                },
                { at: nextParagraphPath },
              );
              Transforms.moveNodes(editor, {
                at: nextParagraphPath,
                to: nextListItemPath,
              });
            }
          } else {
            if (isBlockTextEmpty(paragraphNode)) {
            } else {
              /**
               * If end, insert a list item after and select it
               */
              Transforms.insertNodes(
                editor,
                {
                  type: typeLi,
                  children: [{ type: typeP, children: [{ text: '' }] }],
                },
                { at: nextListItemPath },
              );
              Transforms.select(editor, nextListItemPath);
            }
          }

          /**
           * If there is a list in the list item, move it to the next list item
           */
          if (listItemNode.children.length > 1) {
            Transforms.moveNodes(editor, {
              at: nextParagraphPath,
              to: nextListItemPath.concat(1),
            });
          }

          return;
        }
      }
    } else if (editor.selection && isRangeAtRoot(editor.selection)) {
      const paragraphEntry = Editor.parent(editor, editor.selection);

      if (paragraphEntry) {
        // const [paragraphNode, paragraphPath] = paragraphEntry;
        const [upBlock, bottomBlock] = splitEditorInTwoFragments(editor);
        replaceAllContentInEditorWith(editor, upBlock);
        createAndSelectNewBlockAfter(bottomBlock);
      }
      return;
    }

    insertBreak();
  };

  return editor;
};

export default withList;
