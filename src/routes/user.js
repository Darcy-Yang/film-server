import User from 'models/user';
import Review from 'models/review';
import Words from 'models/words';
import Like from 'models/like';

import sha1 from 'sha1';
import multer from 'koa-multer';
import _path from 'path';
import exception from 'class/exception';

import config from 'config';

import { calculateToken } from 'server/user';

import {
  request,
  query,
  body,
  path,
  middlewares,
  formData,
  summary,
  tags
} from 'koa-swagger-decorator';

const tag = tags(['User']);

const userSchema = {
  name: { type: 'string', required: true },
  password: { type: 'string', required: true }
};

const pathParameter = {
  id: { type: 'number', required: true, description: '当前用户 id' },
  avatar: { type: 'string', required: true, description: '是否为头像文件' }
};

const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, _path.resolve('images/'));
  },
  filename: (req, file, cb) => {
    const { name, ext } = _path.parse(file.originalname);
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const userUpload = multer({ storage: userStorage });

export default class UserRouter {
  @request('get', '/user')
  @query({
    page: { type: 'number', required: false, defaultValue: 1 },
    limit: { type: 'number', required: false, defaultValue: 10 }
  })
  @tag
  @summary('用户列表')
  static async getAll(ctx) {
    const { page, limit } = ctx.validatedQuery;
    const { rows: allUser, count } = await User.findAndCountAll({
      page,
      limit,
      offest: (page - 1) * limit
    });

    allUser.forEach(async user => {
      try {
        user.selected = false;
        const reviewCount = await Review.count({ where: { userId: user.id } });
        const wordsCount = await Words.count({ where: { userId: user.id } });
        await User.update(
          { reviewCount, wordsCount },
          { where: { id: user.id }, silent: true },
        );
      } catch (err) {
        console.log(err);
      }
    });

    ctx.body = { count, allUser };
  }

  @request('post', '/user/register')
  @tag
  @summary('用户注册')
  @body(userSchema)
  static async register(ctx) {
    const { name, password } = ctx.validatedBody;

    // 判断用户名是否重复；
    let user = await User.findOne({ where: { name } });
    if (user) throw new exception.ForbiddenError('该用户名已存在');

    user = await User.create({
      name,
      passwordHash: sha1(password),
      token: calculateToken()
    });

    ctx.body = { user };
  }

  @request('post', '/user/login')
  @tag
  @summary('用户登录')
  @body({
    name: userSchema.name,
    password: userSchema.password
  })
  static async login(ctx) {
    const { name, password } = ctx.validatedBody;

    const user = await User.findOne({ where: { name } });
    if (!user) {
      throw new exception.ForbiddenError('该用户名不存在');
    } else if (user.passwordHash !== sha1(password)) {
      throw new exception.ForbiddenError('密码错误');
    }

    user.token = calculateToken();

    await user.save();

    ctx.body = { user };
  }

  @request('post', '/user/{id}/{avatar}')
  @path(pathParameter)
  @formData({
    file: { type: 'file', required: true, description: '头像文件' }
  })
  @middlewares([userUpload.single('file')])
  @tag
  @summary('用户头像上传')
  static async uploadAvatar(ctx) {
    const { id, avatar } = ctx.validatedParams;
    const user = await User.findById(id);
    if (!user) throw new exception.NotFoundError(`user id ${id}`);

    const { file } = ctx.req;

    if (avatar === 'avatar') {
      await user.update({
        avatar: `${config.baseUrl}/images/${file.filename}`
      });
    } else {
      await user.update({
        cover: `${config.baseUrl}/images/${file.filename}`
      });
    }

    ctx.body = { msg: '上传成功', user: { user } };
  }

  @request('delete', '/user/delete/{id}')
  @path({ id: pathParameter.id })
  @tag
  @summary('删除用户')
  static async deleteUser(ctx) {
    const { id } = ctx.validatedParams;
    await User.destroy({ where: { id } });

    ctx.body = { msg: '删除成功' };
  }

  @request('delete', '/user/delete/batch/{ids}')
  @path({ ids: { type: 'string', required: true, description: '待删除的用户 ids' } })
  @tag
  @summary('批量删除用户')
  static async deleteBatch(ctx) {
    const { ids } = ctx.validatedParams;

    const batch = ids.split(' ');
    console.log(batch);

    await User.destroy({ where: { id: { $in: batch } } });

    ctx.body = { msg: 'success' };
  }

  @request('post', '/user/favor')
  @body({
    id: { type: 'number', required: true },
    type: { type: 'string', required: true },
    movieId: { type: 'number', required: true },
    isReview: { type: 'boolean', required: false, default: false },
    reviewId: { type: 'number', required: false }
  })
  @tag
  @summary('收集用户喜好')
  static async getFavor(ctx) {
    const { id, type, movieId, isReview, reviewId } = ctx.validatedBody;
    const types = type.split(' ');
    let array = [];

    if (isReview) {
      const review = await Review.findById(reviewId);
      await Review.update(
        { reviewNum: review.reviewNum + 1 },
        { where: { id: reviewId } }
      );
    }

    const user = await User.findById(id);
    if (user.movieIds) array = user.movieIds.split(' ');

    function check() {
      for (let i = 0; i < array.length; i += 1) {
        if (`${movieId}` === array[i]) return true;
      }
      return false;
    }

    const isExist = check();

    if (!user.favor) {
      await User.update(
        { favor: type },
        { where: { id } }
      );
    } else {
      types.forEach(async type => {
        if (user.favor.indexOf(type) === -1) {
          await User.update(
            { favor: `${user.favor} ${type}` },
            { where: { id } }
          );
        }
      });
    }

    if (!user.movieIds) {
      await User.update(
        { movieIds: `${movieId}` },
        { where: { id } }
      );
    } else if (!isExist) {
      await User.update(
        { movieIds: `${user.movieIds} ${movieId}` },
        { where: { id } }
      );
    }

    ctx.body = { msg: 'success' };
  }

  @request('get', '/user/{id}')
  @path({ id: pathParameter.id })
  @tag
  @summary('获取用户详细信息')
  static async getDetail(ctx) {
    const { id } = ctx.validatedParams;
    let reviewLikeNum = 0;
    let reviewNum = 0;
    let wordsLikeNum = 0;

    const reviews = await Review.findAll({ where: { userId: id } });

    reviews.forEach(review => {
      reviewLikeNum += review.likeNum;
      reviewNum += review.reviewNum;
    });

    const words = await Words.findAll({ where: { userId: id } });

    words.forEach(word => {
      wordsLikeNum += word.likeNum;
    });

    ctx.body = { reviewLikeNum, reviewNum, wordsLikeNum };
  }

  @request('get', '/user/notice/{id}')
  @path({ id: pathParameter.id })
  @tag
  @summary('获取用户消息通知')
  static async getNotice(ctx) {
    const { id } = ctx.validatedParams;
    const { count, rows: noticeLike } = await Like.findAndCountAll({
      where: { senderId: { $not: id }, receiverId: id, checked: false },
      include: [
        { model: User },
        { model: Review }
      ]
    });

    ctx.body = { count, noticeLike };
  }

  @request('post', '/user/check')
  @body({ id: { type: 'number', required: true, description: '通知 id' } })
  @tag
  @summary('查看消息通知')
  static async check(ctx) {
    const { id } = ctx.validatedBody;
    const notice = await Like.findById(id);

    if (!notice.checked) await Like.update({ checked: true }, { where: { id } });

    ctx.body = { msg: 'success' };
  }
}
