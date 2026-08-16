export type LyricLineKind = 'verse' | 'chorus' | 'quote' | 'note' | 'gap';

export interface LyricLine {
  kind: LyricLineKind;
  text: string;
}

export interface MusicHallLyrics {
  title: string;
  subtitle: string;
  dedication: string;
  lines: readonly LyricLine[];
}

export const MUSIC_HALL_LYRICS: MusicHallLyrics = {
  title: 'Never Gonna Give You Up',
  subtitle: '音乐厅现场歌词',
  dedication: '献给每一个仍在向前走的人',
  lines: [
    { kind: 'verse', text: 'never goona give you up' },
    { kind: 'verse', text: 'never gonna let you down' },
  ],
};
