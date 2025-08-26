const ClientAzyk = require('../models/clientAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const SubscriberAzyk = require('../models/subscriberAzyk');

const type = `
  type Subscriber {
    _id: ID
    createdAt: Date
    user: String
    number: String
    status: String
 }
`;

const query = `
    subscribers: [Subscriber]
`;

const resolvers = {
    subscribers: async(parent, ctx, {user}) => {
        let res = []
        if('admin'===user.role) {
            let findRes = await SubscriberAzyk
                .find({})
                .populate({path: 'user'})
                .sort('-createdAt')
                .lean()
            // Собираем все user._id
            const userIds = findRes
                .filter(item => item.user)
                .map(item => item.user._id.toString());

            // Загружаем клиентов и employment одним махом
            // eslint-disable-next-line no-undef
            const [clients, employments] = await Promise.all([
                ClientAzyk.find({user: {$in: userIds}}).select('user name address').lean(),
                EmploymentAzyk.find({user: {$in: userIds}})
                    .populate({path: 'organization'})
                    .lean()
            ]);

// Для быстрого доступа создаём Map по user._id
            // eslint-disable-next-line no-undef
            const clientMap = {}
            clients.forEach(client => clientMap[client.user.toString()] = client);

            // eslint-disable-next-line no-undef
            const employmentMap = {};
            employments.forEach(employment => employmentMap[employment.user.toString()] = employment);

// Собираем финальный массив
            res = findRes.map(item => {
                let userText = 'неидентифицирован';

                if (item.user) {
                    const userId = item.user._id.toString();
                    const userRole = item.user.role;

                    if (userRole === 'admin') {
                        userText = 'admin';
                   }
                    else if (userRole === 'client') {
                        const client = clientMap[userId];
                        if (client) {
                            userText = `${client.name}${client.address && client.address[0] ?
                                ` (${client.address[0][2] ? `${client.address[0][2]}, ` : ''}${client.address[0][0]})` : ''}`;
                       }
                   }
                    else if (['суперагент', 'суперменеджер'].includes(userRole)) {
                        const emp = employmentMap[userId];
                        if (emp) {
                            userText = `${userRole} ${emp.name}`;
                       }
                   }
                    else {
                        const emp = employmentMap[userId];
                        if (emp) {
                            userText = `${emp.organization.name} ${userRole} ${emp.name}`;
                       }
                   }
               }

                return {
                    _id: item._id,
                    createdAt: item.createdAt,
                    user: userText,
                    number: item.number,
                    status: item.status
               };
           });
       }
        return res
   }
};

module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;