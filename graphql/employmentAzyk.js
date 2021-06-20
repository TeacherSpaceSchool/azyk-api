const EmploymentAzyk = require('../models/employmentAzyk');
const UserAzyk = require('../models/userAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const { createJwtGQL } = require('../module/passport');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const mongoose = require('mongoose')

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
    employments(organization: ID, search: String!, sort: String!, filter: String!): [Employment]
    employmentsTrash(search: String!,): [Employment]
    employment(_id: ID!): Employment
    ecspeditors(_id: ID): [Employment]
    agents(_id: ID): [Employment]
    managers(_id: ID): [Employment]
    sortEmployment: [Sort]
    filterEmployment: [Filter]
`;

const mutation = `
    addEmployment(name: String!, email: String!, phone: [String]!, login: String!, password: String!, role: String!, organization: ID): Data
    setEmployment(_id: ID!, name: String, email: String, newPass: String, role: String, phone: [String], login: String, ): Data
    deleteEmployment(_id: [ID]!): Data
    restoreEmployment(_id: [ID]!): Data
    onoffEmployment(_id: [ID]!): Data
`;

const resolvers = {
    employmentsTrash: async(parent, {search}, {user}) => {
        if(user.role==='admin') {
            return await EmploymentAzyk.find({
                del: 'deleted',
                name: {'$regex': search, '$options': 'i'}
            })
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
        else return []
    },
    employments: async(parent, {organization, search, sort, filter}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            let users
            if(filter&&filter.length){
                users = await UserAzyk.find({
                    role: {'$regex': filter, '$options': 'i'}
                }).distinct('_id').lean()
            }
            return await EmploymentAzyk.find({
                organization: user.organization ? user.organization : organization === 'super' ? null : organization,
                del: {$ne: 'deleted'},
                ...filter && filter.length ? {user: {$in: users}} : {},
                name: {'$regex': search, '$options': 'i'}
            })
                .populate({
                    path: 'user',
                    select: '_id role status login'
                })
                .populate({
                    path: 'organization',
                    select: 'name _id'
                })
                .sort(sort)
                .lean()
        }
    },
    ecspeditors: async(parent, {_id}, {user}) => {
        if (['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let users = await UserAzyk.find({
                role: _id==='super'?'суперэкспедитор':'экспедитор', status: 'active'
            }).distinct('_id').lean()
            return await EmploymentAzyk.find({
                user: {$in: users},
                organization: user.organization?user.organization:_id==='super'?null:_id,
                del: {$ne: 'deleted'}
            })
                .populate({
                    path: 'user',
                    select: '_id role status login'
                })
                .populate({
                    path: 'organization',
                    select: 'name _id'
                })
                .sort('name')
                .lean()
        }
    },
    managers: async(parent, {_id}, {user}) => {
        if (['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let users = await UserAzyk.find({
                role: _id==='super'?'суперменеджер':'менеджер', status: 'active'
            }).distinct('_id').lean()
            return await EmploymentAzyk.find({
                user: {$in: users},
                organization: user.organization?user.organization:_id==='super'?null:_id,
                del: {$ne: 'deleted'}
            })
                .populate({
                    path: 'user',
                    select: '_id role status login'
                })
                .populate({
                    path: 'organization',
                    select: 'name _id'
                })
                .sort('name')
                .lean()
        }
    },
    agents: async(parent, {_id}, {user}) => {
        if (['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let users = await UserAzyk.find({
                role: _id==='super'?'суперагент':'агент', status: 'active'
            }).distinct('_id').lean()
            let agents
            if (user.role==='менеджер') {
                agents = await DistrictAzyk
                    .find({manager: user.employment})
                    .distinct('agent').lean()
            }
            return await EmploymentAzyk.find({
                ...user.role==='менеджер'?{_id: {$in: agents}}:{},
                user: {$in: users},
                organization: user.organization?user.organization:_id==='super'?null:_id,
                del: {$ne: 'deleted'}
            })
                .populate({
                    path: 'user',
                    select: '_id role status login'
                })
                .populate({
                    path: 'organization',
                    select: 'name _id'
                })
                .sort('name')
                .lean()
        }
    },
    employment: async(parent, {_id}, {user}) => {
        if(user.role&&user.role!=='client') {
            let result = await EmploymentAzyk.findOne({
                $or: [
                    {_id: _id},
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
            if(result === null||!['admin', 'суперорганизация', 'организация'].includes(user.role))
                return await EmploymentAzyk.findOne({user: user._id})
                    .populate({
                        path: 'user',
                        select: '_id role status login'
                    })
                    .populate({
                        path: 'organization',
                        select: 'name _id'
                    })
                    .lean()
            if(user.role==='admin')
                return result
            else if(result&&['суперорганизация', 'организация'].includes(user.role))
                return result
            else
                return null
        }
        else
            return null
    },
    sortEmployment: async(parent, ctx, {user}) => {
        let sort = []
        if(user.role==='admin') {
            sort = [
                {
                    name: 'Имя',
                    field: 'name'
                },
                {
                    name: 'Дата',
                    field: 'createdAt'
                }
            ]
        }
        return sort
    },
    filterEmployment: async(parent, ctx, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role))
            return [
                {
                    name: 'Все',
                    value: ''
                },
                {
                    name: 'Агент',
                    value: 'агент'
                },
                {
                    name: 'Менеджер',
                    value: 'менеджер'
                },
                {
                    name: 'Экспедитор',
                    value: 'экспедитор'
                },
                {
                    name: 'Организация',
                    value: 'организация'
                }
            ]
        else return []
    },
};

const resolversMutation = {
    addEmployment: async(parent, {name, email, phone, login, password, role, organization}, {user}) => {
        if(user.role==='admin') {
            let newUser = new UserAzyk({
                login: login.trim(),
                role: role,
                status: 'active',
                password: password,
            });
            newUser = await UserAzyk.create(newUser);
            const client = new EmploymentAzyk({
                name: name,
                email: email,
                phone: phone,
                organization: organization,
                user: newUser._id,
            });
            await EmploymentAzyk.create(client);
        }
        return {data: 'OK'}
    },
    setEmployment: async(parent, {_id, name, email, newPass, role, login, phone}, {user, res}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await EmploymentAzyk.findOne({_id: _id, ...user.organization?{organization: user.organization}:{}})
            if(role==='суперорганизация'&&user.role!=='admin')
                role = 'организация'
            if (role || newPass || login) {
                let objectUser = await UserAzyk.findById(object.user)
                if(login)objectUser.login = login.trim()
                if(newPass)objectUser.password = newPass
                if(role)objectUser.role = role
                await objectUser.save()
                if(objectUser._id.toString()===user._id.toString())
                    await createJwtGQL(res, objectUser)
            }
            if(name)object.name = name
            if(email)object.email = email
            if(phone)object.phone = phone
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteEmployment: async(parent, { _id }, {user}) => {
        let objects = await EmploymentAzyk.find({_id: {$in: _id}})
        for(let i=0; i<objects.length; i++){
            if(user.role==='admin'){
                await EmploymentAzyk.update({_id: objects[i]._id}, {del: 'deleted'})
                await UserAzyk.update({_id: objects[i].user}, {status: 'deactive'})
                await Integrate1CAzyk.deleteOne({
                        organization: objects[i].organization,
                        $or:
                            [
                                {manager: objects[i]._id},
                                {agent: objects[i]._id},
                                {ecspeditor: objects[i]._id}
                            ]
                    }
                )
                let district = await DistrictAzyk.find({
                    organization: objects[i].organization,
                    $or:
                        [
                            {manager: objects[i]._id},
                            {agent: objects[i]._id},
                            {ecspeditor: objects[i]._id}
                        ]
                })
                for(let i1=0; i1<district.length; i1++) {
                    if(district[i1].manager.toString()===objects[i]._id.toString())district[i1].manager=null
                    else if(district[i1].ecspeditor.toString()===objects[i]._id.toString())district[i1].ecspeditor=null
                    else if(district[i1].agent.toString()===objects[i]._id.toString())district[i1].agent=null
                    await district[i1].save()

                }
            }
        }
        return {data: 'OK'}
    },
    restoreEmployment: async(parent, { _id }, {user}) => {
        let objects = await EmploymentAzyk.find({_id: {$in: _id}}).lean()
        for(let i=0; i<objects.length; i++){
            if(user.role==='admin'){
                await EmploymentAzyk.update({_id: objects[i]._id}, {del: null})
                await UserAzyk.update({_id: objects[i].user}, {status: 'active'})
            }
        }
        return {data: 'OK'}
    },
    onoffEmployment: async(parent, { _id }, {user}) => {
        let objects = await EmploymentAzyk.find({_id: {$in: _id}}).lean()
        for(let i=0; i<objects.length; i++){
            if(user.role==='admin'||(['суперорганизация', 'организация'].includes(user.role)&&user.organization.toString()===objects[i].organization.toString())) {
                let object = await UserAzyk.findOne({_id: objects[i].user})
                object.status = object.status === 'active' ? 'deactive' : 'active'
                await object.save()
            }
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;