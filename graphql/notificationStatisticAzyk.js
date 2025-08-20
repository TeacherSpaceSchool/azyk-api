const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const {sendWebPush} = require('../module/webPush');
const {saveImage, urlMain, reductionSearch, unawaited, reductionSearchText} = require('../module/const');
const {roleList} = require('../module/enum');

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
    addNotificationStatistic(icon: Upload, text: String!, title: String!, tag: String, url: String): NotificationStatistic
`;

const resolvers = {
    notificationStatistics: async(parent, {search}, {user}) => {
        if(user.role===roleList.admin)
            return await NotificationStatisticAzyk.find({
                $or: [
                    {title: {$regex: reductionSearchText(search), $options: 'i'}},
                    {text: {$regex: reductionSearchText(search), $options: 'i'}},
                    {tag: {$regex: reductionSearch(search), $options: 'i'}},
                    {url: {$regex: reductionSearch(search), $options: 'i'}}
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
        if(user.role===roleList.admin) {
            let payload = {title, message: text, tag, url}
            if(icon) {
                let {stream, filename} = await icon;
                payload.icon = urlMain + await saveImage(stream, filename)
            }
            unawaited(() => sendWebPush(payload))
            return payload
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;