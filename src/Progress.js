/**
 * Tracks progress of the graph construction and layout
 */
export default class Progress {
  constructor() {
    this.message = '';
    this.phase = 'none';
    this.download = {
      errors: [],
      remaining: 0,
      currentWord: '',
    };
    this.layout = {
      iteration: 0
    };
    this.working = true
  }

  startDownload() {
    this.phase = '检索中';
  }

  startLayout() {
    this.message = '检索完成, 开始生成关系图...';
    this.phase = 'layout';
  }

  setLayoutCompletion(layoutCompletion) {
    if (this.phase === 'layout') {
      this.message = `检索完成. 生成关系图 ${layoutCompletion}%...`;
    }
  }

  updateLayout(remaining, nextWord) {
    this.download.currentWord = nextWord;
    this.download.remaining = remaining;
    this.message = `剩余: ${remaining}.搜索 ${nextWord}`;
  }

  done() {
    this.working = false;
  }

  downloadError(message) {
    this.download.errors.push(message);
  }

  reset() {
    this.phase = 'none',
    this.download.errors = [];
    this.download.remaining = 0;
    this.download.currentWord = '';
    this.layout.iteration = 0;
    this.message = '';
    this.working = true;
  }
}
