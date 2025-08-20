const ErrorAzyk = require('../models/errorAzyk');
const UserAzyk = require('../models/userAzyk');
const {checkFloat} = require('../module/const');
const {roleList} = require('../module/enum');

const type = `
  type Error {
    _id: ID
    createdAt: Date
    err: String
    path: String
 }
`;

const query = `
    errors: [Error]
    errorsStatistic: Statistic
`;

const mutation = `
    clearAllErrors: String
    addError(err: String!, path: String!): String
`;

const getLoginFromPath = (path) => {
    if(path&&path.includes(', login: ')) {
        let splitError = path.split(', login: ');
        splitError = splitError[1].split(', name: ');
        return splitError[0].trim()
    }
}

const resolvers = {
    errors: async(parent, ctx, {user}) => {
        if(roleList.admin===user.role) {
            return await ErrorAzyk.find().sort('-createdAt').lean()
       }
   },
    errorsStatistic: async(parent, ctx, {user}) => {
        if(roleList.admin===user.role) {
            const errors = await ErrorAzyk.find().sort('-createdAt').lean()
            let allErrors = 0, allClients = [], allEmployments = []
            const parsedErrors = {}
            const logins = (errors.filter(error => error.path&&error.path.includes(', login: '))).map(error => getLoginFromPath(error.path))
            const users = await UserAzyk.find({login: {$in: logins}}).select('_id login role').lean()
            const userByLogin = {}
            for (const user of users) {
                userByLogin[user.login] = user
            }
            for (const error of errors) {
                let ID = error.err
                if(ID.includes('gql: String cannot represent value')) ID = 'gql: String cannot represent value'
                if(!parsedErrors[ID]) {
                    parsedErrors[ID] = {
                        error: error.err,
                        clients: [],
                        employments: [],
                        count: 0
                    }
                    allErrors += 1
                }
                parsedErrors[ID].count += 1
                const login = getLoginFromPath(error.path)
                if(login&&userByLogin[login]) {
                    const _id = userByLogin[login]._id.toString()
                    if(userByLogin[login].role===roleList.client&&!parsedErrors[ID].clients.includes(_id)) {
                        parsedErrors[ID].clients.push(_id)
                        if(!allClients.includes(_id))
                            allClients.push(_id)
                    }
                    else if(!parsedErrors[ID].employments.includes(_id)) {
                        parsedErrors[ID].employments.push(_id)
                        if(!allEmployments.includes(_id))
                            allEmployments.push(_id)
                    }
                }
            }
            let errorsStatistic = []
            for(const key in parsedErrors) {
                errorsStatistic.push({
                    _id: key,
                    data: [
                        parsedErrors[key].error,
                        parsedErrors[key].count,
                        parsedErrors[key].clients.length,
                        parsedErrors[key].employments.length,
                    ]
                })
            }
            errorsStatistic = errorsStatistic.sort(function(a, b) {
                return checkFloat(b.data[1]) - checkFloat(a.data[1])
            });
            errorsStatistic = [
                {
                    _id: 'All',
                    data: [
                        allErrors,
                        allClients.length,
                        allEmployments.length
                    ]
                },
                ...errorsStatistic
            ]
            return {
                columns: ['ошибка', 'количество', 'клиенты', 'сотрудники'],
                row: errorsStatistic
            };
       }
   }
};

const resolversMutation = {
    addError: async(parent, {err, path}, {user}) => {
        if (user.role)
            path += `, role: ${user.role}, login: ${user.login}${user.name ? `, name: ${user.name}` : ''}`
        await ErrorAzyk.create({err, path})
        return 'OK'
    },
    clearAllErrors: async(parent, ctx, {user}) => {
        if(roleList.admin===user.role) {
            await ErrorAzyk.deleteMany()
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;