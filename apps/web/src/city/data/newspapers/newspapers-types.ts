export type NewspaperBlockKind =
  | 'motto'
  | 'separator'
  | 'section'
  | 'label'
  | 'text'
  | 'link'
  | 'editor';

export interface NewspaperBlock {
  kind: NewspaperBlockKind;
  text: string;
  href?: string;
  hrefType?: 'discussion' | 'experiment';
}

export interface NewspaperPage {
  title: string;
  blocks: readonly NewspaperBlock[];
}

export interface NewspaperIssue {
  id: string;
  title: string;
  series: string;
  date: string;
  pages: readonly NewspaperPage[];
}
