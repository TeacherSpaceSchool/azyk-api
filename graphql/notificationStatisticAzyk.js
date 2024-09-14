const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const {sendWebPush} = require('../module/webPush');
const { saveImage, urlMain, reductionSearch} = require('../module/const');

const type = `
  type NotificationStatistic {
    _id: ID
    createdAt: Date
    title: String
    text: String
    tag: String
    url: String
    icon: String
    delivered: Int
    failed: Int
    click: Int
  }
`;

const query = `
    notificationStatistics(search: String!): [NotificationStatistic]
`;

const mutation = `
    addNotificationStatistic(icon: Upload, text: String!, title: String!, tag: String, url: String): Data
`;

const resolvers = {
    notificationStatistics: async(parent, {search}, {user}) => {
        if('admin'===user.role)
            return await NotificationStatisticAzyk.find({
                $or: [
                    {title: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {text: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {tag: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {url: {'$regex': reductionSearch(search), '$options': 'i'}}
                ]
            })
                .sort('-createdAt')
                .lean()
        else
            return []
    }
};

const resolversMutation = {
    addNotificationStatistic: async(parent, {text, title, tag , url, icon}, {user}) => {
        if('admin'===user.role){
            let payload = {title: title, message: text, user: 'all', tag: tag, url: url}
            if(icon){
                let { stream, filename } = await icon;
                filename = await saveImage(stream, filename)
                payload.icon = urlMain+filename
            }
            await sendWebPush(payload)
        }
        return {data: 'OK'};
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;