import Words from 'models/words';
import User from 'models/user';
import WordsLike from 'models/wordsLike';
import WordsCollect from 'models/wordsCollect';

import {
  request,
  query,
  body,
  path,
  summary,
  tags
} from 'koa-swagger-decorator';

const tag = tags(['Words']);

const pathParameter = {
  id: { type: 'number', required: true, description: '当前用户 ID' }
};

const wordsSchema = {
  userId: { type: 'number', required: true },
  title: { type: 'string', required: true },
  content: { type: 'string', required: true }
};

export default class WordsRouter {
  @request('get', '/words/all')
  @query({
    page: { type: 'number', required: false, default: 1 },
    limit: { type: 'number', required: false, default: 10 },
    searchWord: { type: 'string', required: false }
  })
  @tag
  @summary('获取所有台词')
  static async getAll(ctx) {
    const { page, limit, searchWord } = ctx.validatedQuery;

    const { count, rows: words } = await Words.findAndCountAll({
      where: searchWord ? { title: { $like: `%${searchWord}%` } } : {},
      page,
      limit,
      offest: (page - 1) * limit
    });

    ctx.body = { count, words };
  }

  @request('get', '/words/{id}')
  @query({
    page: { type: 'number', required: false, default: 1 },
    limit: { type: 'number', required: false, default: 10 },
    searchWord: { type: 'string', required: false }
  })
  @path(pathParameter)
  @tag
  @summary('获取处理后的台词')
  static async getWords(ctx) {
    const { id } = ctx.validatedParams;
    const { page, limit, searchWord } = ctx.validatedQuery;

    const { count, rows: words } = await Words.findAndCountAll({
      where: searchWord ? { $or: [{ title: { $like: `%${searchWord}%` } }, { content: { $like: `%${searchWord}%` } }] } : {},
      page,
      limit,
      offest: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
      include: [{ model: User }]
    });

    words.forEach(word => { word.isLiked = false; });
    words.forEach(word => { word.isCollected = false; });

    (await WordsLike.findAll({ where: { senderId: id } })).forEach(like => {
      words.forEach(word => {
        if (word.id === like.wordsId) word.isLiked = true;
      });
    });
    (await WordsCollect.findAll({ where: { senderId: id } })).forEach(collect => {
      words.forEach(word => {
        if (word.id === collect.wordsId) word.isCollected = true;
      });
    });

    const pageCount = Math.ceil(count / limit);

    ctx.body = { pageCount, words };
  }

  @request('post', '/words')
  @body(wordsSchema)
  @tag
  @summary('创建台词')
  static async create(ctx) {
    const { userId, title, content } = ctx.validatedBody;

    const words = await Words.create({
      userId,
      title,
      content
    });

    ctx.body = { words };
  }

  @request('get', '/words/{id}/all')
  @path(pathParameter)
  @tag
  @summary('获取当前用户的台词')
  static async getCurrentWords(ctx) {
    const { id } = ctx.validatedParams;

    const words = await Words.findAll(
      { where: { userId: id } }
    );

    ctx.body = { words };
  }

  @request('get', '/words/{id}/count')
  @path(pathParameter)
  @tag
  @summary('获取当前用户台词总数')
  static async getCurrentWordsCount(ctx) {
    const { id } = ctx.validatedParams;

    const count = await Words.count({ where: { userId: id } });

    ctx.body = { count };
  }
}
