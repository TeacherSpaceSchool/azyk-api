const EmploymentAzyk = require('../models/employmentAzyk');
const UserAzyk = require('../models/userAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const {unawaited, isNotEmpty, defaultLimit, reductionSearchText} = require('../module/const');
const randomstring = require('randomstring');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type Employment {
    _id: ID
    name: String
    del: String
    createdAt: Date
    email: String
    phone: [String]
    user: Status
    organization: Organization
 }
`;

const query = `
    employments(organization: ID, search: String!, filter: String!, skip: Int): [Employment]
    employmentsCount(organization: ID, search: String!, filter: String!): String
    employment(_id: ID!): Employment
`;

const mutation = `
    addEmployment(name: String!, email: String!, phone: [String]!, login: String!, password: String!, role: String!, organization: ID): String
    setEmployment(_id: ID!, name: String, email: String, newPass: String, role: String, phone: [String], login: String, ): String
    deleteEmployment(_id: ID!): String
    onoffEmployment(_id: ID!): String
`;

const resolvers = {
    employments: async(parent, {organization, search, filter, skip}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let filteredUsers = await UserAzyk.find({
                $and: [
                    ...filter?[{role: {$regex: filter, $options: 'i'}}]:[],
                    {role: {$nin: [
                        ...user.role!=='admin'?['суперорганизация', 'организация']:[],
                        ...user.role==='менеджер'?['менеджер']:[],
                    ]}}
                ]
            }).distinct('_id')
            return await EmploymentAzyk.find({
                organization: user.organization||(organization==='super'?null:organization),
                del: {$ne: 'deleted'},
                ...filter && filter.length ? {user: {$in: filteredUsers}} : {},
                name: {$regex: reductionSearchText(search), $options: 'i'}
           })
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .populate({
                    path: 'user',
                    select: '_id role status login'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id'
               })
                .sort('-createdAt')
                .lean()
       }
   },
    employmentsCount: async(parent, {organization, search, filter}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let filteredUsers = await UserAzyk.find({
                $and: [
                    ...filter?[{role: {$regex: filter, $options: 'i'}}]:[],
                    {role: {$nin: [
                                ...user.role!=='admin'?['суперорганизация', 'организация']:[],
                                ...user.role==='менеджер'?['менеджер']:[],
                            ]}}
                ]
            }).distinct('_id')
            return await EmploymentAzyk.countDocuments({
                organization: user.organization||(organization==='super'?null:organization),
                del: {$ne: 'deleted'},
                ...filter && filter.length ? {user: {$in: filteredUsers}} : {},
                name: {$regex: reductionSearchText(search), $options: 'i'}
           })
       }
   },
    employment: async(parent, {_id}, {user}) => {
        if(user.role&&user.role!=='client') {
            if(!['admin', 'суперорганизация', 'организация'].includes(user.role)) _id = user._id
            return await EmploymentAzyk.findOne({
                $or: [
                    {_id},
                    {user: _id}
                ],
                ...user.organization?{organization: user.organization}:{},
           })
                .populate({
                    path: 'user',
                    select: '_id role status login'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id'
               })
                .lean()
       }
   },
};

const resolversMutation = {
    addEmployment: async(parent, {name, email, phone, login, password, role, organization}, {user}) => {
        if(user.role==='admin') {
            const newUser = await UserAzyk.create({
                login: login.trim(),
                role: role,
                status: 'active',
                password: password,
           });
            const createdObject = await EmploymentAzyk.create({
                name: name,
                email,
                phone,
                organization,
                user: newUser._id,
           });
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'EmploymentAzyk', name, object: createdObject._id}))
            return createdObject._id
       }
   },
    setEmployment: async(parent, {_id, name, email, newPass, role, login, phone}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await EmploymentAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}})
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'EmploymentAzyk', name: object.name, object: _id, data: {name, email, newPass, role, login, phone}}))
            if(role==='суперорганизация'&&user.role!=='admin')
                role = 'организация'
            if (role || newPass || login) {
                let objectUser = await UserAzyk.findById(object.user)
                if(login)objectUser.login = login.trim()
                if(newPass)objectUser.password = newPass
                if(role)objectUser.role = role
                await objectUser.save()
           }
            if(name)object.name = name
            if(email)object.email = email
            if(phone)object.phone = phone
            await object.save();
       }
        return 'OK'
   },
    deleteEmployment: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            // eslint-disable-next-line no-undef
            const [employment] = await Promise.all([
                //получаем ссылку на пользователя
                EmploymentAzyk.findOne({_id}).select('name user').lean(),
                //если пользователь менеджер на районе то очищаем
                DistrictAzyk.updateMany({manager: _id}, {manager: null}),
                //если пользователь агент на районе то очищаем
                DistrictAzyk.updateMany({agent: _id}, {agent: null}),
                //если пользователь экспедитор на районе то очищаем
                DistrictAzyk.updateMany({forwarder: _id}, {forwarder: null}),
                //отмечаем сотрудника как удаленного
                EmploymentAzyk.updateMany({_id}, {del: 'deleted'}),
                //удаляем интеграции
                Integrate1CAzyk.deleteMany({$or: [{manager: _id}, {agent: _id}, {forwarder: _id}]})
            ])
            //обновляем статус пользователя на деактивирован
            await UserAzyk.updateOne({_id: employment.user}, {status: 'deactive', login: randomstring.generate({length: 12, charset: 'numeric'})})

            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'EmploymentAzyk', name: employment.name, object: _id}))
       }
        return 'OK'
   },
    onoffEmployment: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            //получаем ссылку на пользователя
            const employment = await EmploymentAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}}).select('name user').lean()
            //находим пользователя
            const employmentUser = await UserAzyk.findOne({_id: employment.user}).select('_id status').lean()
            //обновляем статус пользователя
            const newStatus = employmentUser.status==='active'?'deactive':'active'
            await UserAzyk.updateOne({_id: employmentUser._id}, {status: newStatus})
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'EmploymentAzyk', name: employment.name, object: _id, data: {status: newStatus}}))
            return 'OK'
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;