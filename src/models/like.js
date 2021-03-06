import Sequelize from 'sequelize';
import moment from 'moment';

import User from 'models/user';
import Review from 'models/review';

import db from 'db';

const Like = db.define('like', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  senderId: { type: Sequelize.INTEGER, allowNull: false },
  receiverId: { type: Sequelize.INTEGER, allowNull: false },
  reviewId: { type: Sequelize.INTEGER, allowNull: false },
  checked: { type: Sequelize.BOOLEAN, defaultValue: false },
  createdAt: {
    type: Sequelize.DATE,
    get() {
      return moment(this.getDataValue('createdAt')).format('YYYY-MM-DD HH:mm:ss');
    }
  },
  updatedAt: {
    type: Sequelize.DATE,
    get() {
      return moment(this.getDataValue('updatedAt')).format('YYYY-MM-DD HH:mm:ss');
    }
  }
});

Like.belongsTo(User, { foreignKey: 'receiverId' });
Like.belongsTo(User, { foreignKey: 'senderId' });
Like.belongsTo(Review, { foreignKey: 'reviewId' });

export default Like;
