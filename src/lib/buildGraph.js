import jsonpFetch from "./jsonpFetch";
import bus from '../bus';
import _ from 'lodash-es'

/**
 * This function builds a graph from google's auto-suggestions.
 */
export default function buildGraph(entryWord, pattern, MAX_DEPTH, progress) {
  entryWord = entryWord && entryWord.trim();
  if (!entryWord) return;

  entryWord = entryWord.toLocaleLowerCase();

  const insertPosition = pattern.indexOf('...');
  if (insertPosition < 0) {
    throw new Error('Query pattern is missing "..."');
  }
  const queryPosition = pattern.indexOf('[query]');
  if (queryPosition < 0) {
    throw new Error('Query pattern is missing "[query]" keyword');
  }

  if (insertPosition < queryPosition) {
    throw new Error('[query] should come before ...');
  }

  let cancelled = false;
  let pendingResponse;
  let graph = require('ngraph.graph')();
  graph.maxDepth = MAX_DEPTH;
  let queue = [];
  let requestDelay = 300 + Math.random() * 100;
  progress.startDownload();

  startQueryConstruction();

  return {
    dispose,
    graph
  }

  function dispose() {
    cancelled = true;
    if (pendingResponse) {
      pendingResponse.cancel();
      pendingResponse = null;
    }
  }

  function startQueryConstruction() {
    graph.addNode(entryWord, {depth: 0});
    fetchNext(entryWord);
  }

  function loadSiblings(parent, results) {
    let q = fullQuery(parent).toLocaleLowerCase();
    var parentNode = graph.getNode(parent);

    if (!parentNode) {
      throw new Error('Parent is missing for ' + parent);
    }

    console.log('results =>', results)
    results.filter(x => x.toLocaleLowerCase().indexOf(q) === 0)
      .map(x => x.substring(q.length))
      .map(item => {
        // 中文断句
        let splitCharInChinese = [
            // 各类虚词
            // 连词
            '同','和','跟','与','及','或','以及',// （连接词和短语）
            '而','而且','并','并且','或者', //（连接词语或者分句）
            '不但','不仅','虽然','但是','然而','如果','与其','因为','所以', // （连接复句中的分句,复句中常见的关联词语.在这里要注意,复句中也有用副词连接的.副词现在大多书中列为实词类.）
    
            '对于','关于','跟','和','给','替','向','同','除了', // 表示关涉对象：
            '按照','遵照','依照','靠','本着','用','通过','根据','据','拿','比', // 表示方式
            '被','给','让','叫','归','由','把','将','管', // 表施事
            '因','因为','由于','为','为了','为着', // 表示原因
    
            // 助词
            '的', // ,'得','地' 结构助词
            '着','了','过', // 动态助词
            '似的','一样','一般', // 比况助词
            '的','了','么','吧','呢','啊','着','嘛','呗','罢了','而已','也罢','也好','啦','嘞','喽','着呢',
          
            // 额外补充
            '有', '什么', '怎', '哪', '是', ' ', '合并'
          ]
        let splitter = new RegExp( splitCharInChinese.join('|'))
        let result = item.split(splitter)[0]
        return result
      })
      .filter(item => item.length > 0)
      .forEach(other => {
        const hasOtherNode = graph.hasNode(other);
        const hasOtherLink = graph.getLink(other, parent) || graph.getLink(parent, other);
        if (hasOtherNode) {
          if (!hasOtherLink) {
            graph.addLink(parent, other);
          }
          return;
        }

        let depth = parentNode.data.depth + 1;
        graph.addNode(other, {depth});
        graph.addLink(parent, other);
        if (depth < MAX_DEPTH) queue.push(other);
      });

    setTimeout(loadNext, requestDelay);
  }

  function loadNext() {
    if (cancelled) return;
    if (queue.length === 0) {
      bus.fire('graph-ready', graph);
      return;
    }

    let nextWord = queue.shift();
    fetchNext(nextWord);
    progress.updateLayout(queue.length, nextWord);
  }

  async function fetchNext(query) {
    pendingResponse = await getResponse(fullQuery(query))
      .then(res => onPendingReady(res, query))
      .catch((msg) => {
        const err = 'Failed to download ' + query + '; Message: ' + msg;
        console.error(err);
        progress.downloadError(err)
        loadNext();
      });
  }

  function onPendingReady(res, query) {
    console.log({res, query})
    let suggestionList = _.get(res, ['s'], [])
    if (suggestionList.length >= 0) {
      loadSiblings(query, suggestionList);
    } else {
      console.error(res);
      throw new Error('Unexpected response');
    }
  }

  function fullQuery(query) {
    return pattern.replace('[query]', query).replace('...', '');
  }

  async function getResponse(query) {
    let response = await jsonpFetch('//suggestion.baidu.com/su?wd=' + encodeURIComponent(query));
    console.log({query, response})
    return response
  }
}