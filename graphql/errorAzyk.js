const ErrorAzyk = require('../models/errorAzyk');
const {checkFloat} = require('../module/const');

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

const resolvers = {
    errors: async(parent, ctx, {user}) => {
        if('admin'===user.role) {
            return await ErrorAzyk.find().sort('-createdAt').lean()
       }
   },
    errorsStatistic: async(parent, ctx, {user}) => {
        if('admin'===user.role) {
            const errors = await ErrorAzyk.find().sort('-createdAt').lean()
            let allErrors = 0, allPaths = []
            const parsedErrors = {}
            for (const error of errors) {
                let ID = error.err
                if(ID.includes('gql: String cannot represent value')) ID = 'gql: String cannot represent value'
                if(!parsedErrors[ID]) {
                    parsedErrors[ID] = {
                        error: error.err,
                        count: 0,
                        paths: []
                    }
                    allErrors += 1
                }
                parsedErrors[ID].count += 1
                if(!parsedErrors[ID].paths.includes(error.path))
                    parsedErrors[ID].paths = [...parsedErrors[ID].paths, error.path]
                if(!allPaths.includes(error.path))
                    allPaths = [...allPaths, error.path]
            }
            const keys = Object.keys(parsedErrors)

            let errorsStatistic = []
            for(const key of keys) {
                errorsStatistic.push({
                    _id: key,
                    data: [
                        parsedErrors[key].error,
                        parsedErrors[key].paths.length,
                        parsedErrors[key].count,
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
                        allPaths.length,
                        allErrors
                    ]
                },
                ...errorsStatistic
            ]
            return {
                columns: ['ошибка', 'пользователи', 'количество'],
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
        if('admin'===user.role) {
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