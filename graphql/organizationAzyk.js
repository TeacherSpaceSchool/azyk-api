const mongoose = require('mongoose');
const OrganizationAzyk = require('../models/organizationAzyk');
const AutoAzyk = require('../models/autoAzyk');
const RepairEquipmentAzyk = require('../models/repairEquipmentAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const DeliveryDateAzyk = require('../models/deliveryDateAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ItemAzyk = require('../models/itemAzyk');
const BasketAzyk = require('../models/basketAzyk');
const UserAzyk = require('../models/userAzyk');
const AdsAzyk = require('../models/adsAzyk');
const PlanAzyk = require('../models/planAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const { saveImage, saveFile, deleteFile, urlMain, isTestUser, isNotTestUser, reductionSearch} = require('../module/const');

const type = `
  type Organization {
    _id: ID
    createdAt: Date
    name: String
    address: [String]
    email: [String]
    phone: [String]
    info: String
    miniInfo: String
    catalog: String
    agentHistory: Int
    status: String
    type: String
    image: String
    warehouse: String
    minimumOrder: Int
    accessToClient: Boolean
    unite: Boolean
    agentSubBrand: Boolean
    clientSubBrand: Boolean
    addedClient: Boolean
    superagent: Boolean
    consignation: Boolean
    refusal: Boolean
    onlyDistrict: Boolean
    dateDelivery: Boolean
    onlyIntegrate: Boolean
    autoAcceptAgent: Boolean
    autoAcceptNight: Boolean
    divideBySubBrand: Boolean
    clientDuplicate: Boolean
    calculateStock: Boolean
    cities: [String]
    del: String
    priotiry: Int
    pass: String
    autoIntegrate: Boolean
    
    reiting: Int
  }
`;

const query = `
    brandOrganizations(search: String!, filter: String!, city: String): [Organization]
    organizations(search: String!, filter: String!, city: String): [Organization]
    organizationsTrash(search: String!): [Organization]
    organization(_id: ID!): Organization
    filterOrganization: [Filter]
`;

const mutation = `
    addOrganization(cities: [String]!, autoIntegrate: Boolean!, catalog: Upload, pass: String, warehouse: String!, miniInfo: String!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload!, name: String!, address: [String]!, email: [String]!, phone: [String]!, info: String!, accessToClient: Boolean!, consignation: Boolean!, refusal: Boolean!, addedClient: Boolean!, agentSubBrand: Boolean!, clientSubBrand: Boolean!, unite: Boolean!, superagent: Boolean!, onlyDistrict: Boolean!, dateDelivery: Boolean!, onlyIntegrate: Boolean!, autoAcceptAgent: Boolean!, autoAcceptNight: Boolean!, clientDuplicate: Boolean!, calculateStock: Boolean!, divideBySubBrand: Boolean!): Data
    setOrganization(cities: [String], pass: String, autoIntegrate: Boolean, catalog: Upload, warehouse: String, miniInfo: String, _id: ID!, priotiry: Int, minimumOrder: Int, agentHistory: Int, image: Upload, name: String, address: [String], email: [String], phone: [String], info: String, accessToClient: Boolean, consignation: Boolean, refusal: Boolean, addedClient: Boolean, agentSubBrand: Boolean, clientSubBrand: Boolean, unite: Boolean, superagent: Boolean, onlyDistrict: Boolean, dateDelivery: Boolean, onlyIntegrate: Boolean, autoAcceptAgent: Boolean, autoAcceptNight: Boolean, clientDuplicate: Boolean, calculateStock: Boolean, divideBySubBrand: Boolean): Data
    restoreOrganization(_id: [ID]!): Data
    deleteOrganization(_id: [ID]!): Data
    onoffOrganization(_id: [ID]!): Data
`;

const resolvers = {
    brandOrganizations: async (parent, { search, filter, city }, { user }) => {
        // Разрешаем выполнение только для указанных ролей
        if (!['admin', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент', 'суперэкспедитор', 'client'].includes(user.role)) {
            return [];
        }

        // Фильтр по городу - либо из аргументов, либо из данных пользователя
        const cityFilter = city || user.city;

        // Флаг для удобства: является ли пользователь клиентом
        const isClient = user.role === 'client';
        const isAdmin = user.role === 'admin';
        const isSuperAgent = ['суперагент', 'суперэкспедитор'].includes(user.role);

        // Получаем все элементы (товары или позиции) из коллекции ItemAzyk с учетом города, статуса и удаления
        const brandItems = await ItemAzyk.find({
            ...(user.organization ? { organization: user.organization } : {}),
            ...(cityFilter ? { city: cityFilter } : {}),
            del: { $ne: 'deleted' }, // исключаем удалённые
            ...(isAdmin ? {} : { status: 'active' }), // если не админ - только активные
        })
            .select('organization subBrand')
            .lean();

        // Множества для хранения уникальных организаций и суббрендов
        // eslint-disable-next-line no-undef
        let organizationsSet = new Set();
        // eslint-disable-next-line no-undef
        const subBrandsSet = new Set();

        // Для клиента отдельно выбираем организации, у которых clientSubBrand !== true (т.е. без суббрендов)
        // eslint-disable-next-line no-undef
        const organizationsWithoutSubBrandClientSet = new Set();

        if (isClient) {
            const clientOrgs = await OrganizationAzyk.find({
                ...(cityFilter ? { cities: cityFilter } : {}),
                status: 'active',
                del: { $ne: 'deleted' },
                clientSubBrand: { $ne: true }
            }).distinct('_id').lean();

            clientOrgs.forEach(id => organizationsWithoutSubBrandClientSet.add(id.toString()));
        }

        // Формируем множества организаций и суббрендов из brandItems
        brandItems.forEach(item => {
            const orgId = item.organization.toString();

            // Добавляем организацию, если:
            // - пользователь не клиент, либо
            // - у организации нет суббренда, либо
            // - организация есть в списке организаций без суббрендов для клиента
            if (!isClient || !item.subBrand || organizationsWithoutSubBrandClientSet.has(orgId)) {
                organizationsSet.add(orgId);
            }

            // Отдельно собираем суббренды, исключая организации без суббрендов
            if ((!isClient || !organizationsWithoutSubBrandClientSet.has(orgId)) && item.subBrand) {
                subBrandsSet.add(item.subBrand.toString());
            }
        });

        // Запрашиваем организации с фильтрами и сортируем по приоритету
        const organizations = organizationsSet.size>0?await OrganizationAzyk.find({
            _id: { $in: Array.from(organizationsSet) },
            name: { $regex: reductionSearch(search), $options: 'i' },
            status:
                (isAdmin || isTestUser(user))
                    ? filter.length === 0
                        ? { $regex: filter, $options: 'i' }
                        : filter
                    : 'active',
            ...(cityFilter ? { cities: cityFilter } : {}),
            del: { $ne: 'deleted' },
            ...(isSuperAgent ? { superagent: true } : {}),
        })
            .select('name autoAcceptAgent _id image miniInfo unite onlyIntegrate onlyDistrict priotiry catalog')
            .sort('-priotiry')
            .lean():[];

        // Запрашиваем суббренды с учетом фильтров и с заполнением организации (populate)
        const subBrands = subBrandsSet.size>0?await SubBrandAzyk.find({
            _id: { $in: Array.from(subBrandsSet) },
            name: { $regex: reductionSearch(search), $options: 'i' },
            status:
                (isAdmin || isTestUser(user))
                    ? filter.length === 0
                        ? { $regex: filter, $options: 'i' }
                        : filter
                    : 'active',
            ...(cityFilter ? { cities: cityFilter } : {}),
            del: { $ne: 'deleted' },
            ...(user.organization ? { organization: user.organization } : {})
        })
            .populate({
                path: 'organization',
                select: 'autoAcceptAgent _id unite onlyIntegrate onlyDistrict'
            })
            .sort('-priotiry')
            .lean():[];

        // Добавляем в каждый суббренд дополнительные поля из организации и тип для отличия
        subBrands.forEach(subBrand => {
            subBrand.type = 'subBrand';
            subBrand.autoAcceptAgent = subBrand.organization.autoAcceptAgent;
            subBrand.unite = subBrand.organization.unite;
            subBrand.onlyIntegrate = subBrand.organization.onlyIntegrate;
            subBrand.onlyDistrict = subBrand.organization.onlyDistrict;
        });

        // Объединяем суббренды и организации в один массив и сортируем по приоритету
        let organizationsRes = [...subBrands, ...organizations].sort((a, b) => b.priotiry - a.priotiry);

        // Для роли клиента фильтруем организации, учитывая только интеграцию и район клиента
        if (isClient) {
            // eslint-disable-next-line no-undef
            const filtered = await Promise.all(
                organizationsRes.map(async (org) => {
                    // Если это суббренд, берем данные организации из поля organization
                    const orgData = org.organization || org;

                    // Проверяем условия только интеграции и только района
                    const onlyIntegrate = orgData.onlyIntegrate;
                    const onlyDistrict = orgData.onlyDistrict;
                    const orgId = orgData._id;

                    // Проверяем наличие района и интеграции для клиента (если они нужны)
                    const districtPromise = onlyDistrict
                        ? DistrictAzyk.findOne({ client: user.client, organization: orgId }).select('_id').lean()
                        // eslint-disable-next-line no-undef
                        : Promise.resolve(true);
                    const integratePromise = onlyIntegrate
                        ? Integrate1CAzyk.findOne({ client: user.client, organization: orgId }).select('_id').lean()
                        // eslint-disable-next-line no-undef
                        : Promise.resolve(true);

                    // eslint-disable-next-line no-undef
                    const [district, integrate] = await Promise.all([districtPromise, integratePromise]);

                    // Возвращаем организацию, только если все условия выполнены
                    if ((onlyIntegrate && !integrate) || (onlyDistrict && !district)) {
                        return null;
                    }
                    return org;
                })
            );

            // Фильтруем null значения
            organizationsRes = filtered.filter(Boolean);
        }

        return organizationsRes;
    },
    organizations: async(parent, {search, filter, city}, {user}) => {
        return await OrganizationAzyk.find({
            name: {'$regex': reductionSearch(search), '$options': 'i'},
            ...(isNotTestUser(user)&&user.role!=='admin')?{status:'active'}:filter.length?{status: filter}:{},
            ...city?{cities: city}:{},
            del: {$ne: 'deleted'}
        })
            .select('name _id image miniInfo')
            .sort('-priotiry')
            .lean()
    },
    organizationsTrash: async(parent, {search}, {user}) => {
        if(user.role==='admin'){
            return await OrganizationAzyk.find({
                name: {'$regex': reductionSearch(search), '$options': 'i'},
                del: 'deleted'
            })
                .select('name _id image miniInfo')
                .sort('-createdAt')
                .lean()
        }
    },
    organization: async(parent, {_id}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            let subBrand = await SubBrandAzyk.findOne({_id: _id}).select('organization name minimumOrder').lean()
            let organization = await OrganizationAzyk.findOne({
                _id: subBrand?subBrand.organization:_id
            })
                .lean()
            if(subBrand) {
                organization.name = `${subBrand.name} (${organization.name})`
                if(subBrand.minimumOrder) organization.minimumOrder = subBrand.minimumOrder
            }
            return organization
        }
    },
    filterOrganization: async(parent, ctx, {user}) => {
        if(user.role==='admin')
            return await [
                {
                    name: 'Все',
                    value: ''
                },
                {
                    name: 'Активные',
                    value: 'active'
                },
                {
                    name: 'Неактивные',
                    value: 'deactive'
                }
            ]
        else
            return await []
    },
};

const resolversMutation = {
    addOrganization: async(parent, {cities, autoIntegrate, catalog, addedClient, agentSubBrand, clientSubBrand, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, dateDelivery, pass, warehouse, superagent, unite, miniInfo, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, accessToClient, consignation, refusal, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin'){
            let { stream, filename } = await image;
            filename = await saveImage(stream, filename)
            let objectOrganization = new OrganizationAzyk({
                image: urlMain+filename,
                name: name,
                status: 'active',
                address: address,
                email: email,
                phone: phone,
                info: info,
                minimumOrder: minimumOrder,
                accessToClient: accessToClient,
                consignation: consignation,
                refusal: refusal,
                priotiry: priotiry,
                onlyDistrict: onlyDistrict,
                unite: unite,
                superagent: superagent,
                onlyIntegrate: onlyIntegrate,
                miniInfo: miniInfo,
                warehouse: warehouse,
                cities: cities,
                autoAcceptAgent,
                autoAcceptNight,
                clientDuplicate,
                calculateStock,
                divideBySubBrand,
                dateDelivery,
                addedClient,
                agentSubBrand,
                clientSubBrand,
                autoIntegrate,
                agentHistory
            });
            if(catalog){
                let { stream, filename } = await catalog;
                objectOrganization.catalog = urlMain+(await saveFile(stream, filename))
            }
            if(pass)
                objectOrganization.pass = pass
            objectOrganization = await OrganizationAzyk.create(objectOrganization)
        }
        return {data: 'OK'};
    },
    setOrganization: async(parent, {catalog, cities, addedClient, agentSubBrand, clientSubBrand, autoIntegrate, dateDelivery, autoAcceptAgent, autoAcceptNight, clientDuplicate, calculateStock, divideBySubBrand, pass, warehouse, miniInfo, superagent, unite, _id, priotiry, info, phone, email, address, image, name, minimumOrder, agentHistory, accessToClient, refusal, consignation, onlyDistrict, onlyIntegrate}, {user}) => {
        if(user.role==='admin'||(['суперорганизация', 'организация'].includes(user.role)&&user.organization.toString()===_id.toString())) {
            let object = await OrganizationAzyk.findById(_id)
            if (image) {
                let {stream, filename} = await image;
                await deleteFile(object.image)
                filename = await saveImage(stream, filename)
                object.image = urlMain + filename
            }
            if(catalog){
                if(object.catalog)
                    await deleteFile(object.catalog)
                let { stream, filename } = await catalog;
                object.catalog = urlMain+(await saveFile(stream, filename))
            }
            if(user.role==='admin'&&pass!==undefined) object.pass = pass
            if(cities) object.cities = cities
            if(name) object.name = name
            if(info) object.info = info
            if(phone) object.phone = phone
            if(email) object.email = email
            if(address) object.address = address
            if(warehouse) object.warehouse = warehouse
            if(superagent!=undefined) object.superagent = superagent
            if(unite!=undefined) object.unite = unite
            if(onlyDistrict!=undefined) object.onlyDistrict = onlyDistrict
            if(autoAcceptAgent!=undefined) object.autoAcceptAgent = autoAcceptAgent
            if(clientDuplicate!=undefined) object.clientDuplicate = clientDuplicate
            if(calculateStock!=undefined) object.calculateStock = calculateStock
            if(autoAcceptNight!=undefined) {
                let _object = new ModelsErrorAzyk({
                    err: `autoAcceptNight: ${object.autoAcceptNight} => ${autoAcceptNight}`,
                    path: 'setOrganization'
                });
                ModelsErrorAzyk.create(_object)
                object.autoAcceptNight = autoAcceptNight
            }
            if(divideBySubBrand!=undefined) object.divideBySubBrand = divideBySubBrand
            if(dateDelivery!=undefined) object.dateDelivery = dateDelivery
            if(onlyIntegrate!=undefined) object.onlyIntegrate = onlyIntegrate
            if(priotiry!=undefined) object.priotiry = priotiry
            if(consignation!=undefined) object.consignation = consignation
            if(refusal!=undefined) object.refusal = refusal
            if(accessToClient!=undefined) object.accessToClient = accessToClient
            if(minimumOrder!=undefined) object.minimumOrder = minimumOrder
            if(miniInfo!=undefined) object.miniInfo = miniInfo
            if(addedClient!=undefined) object.addedClient = addedClient
            if(agentSubBrand!=undefined) object.agentSubBrand = agentSubBrand
            if(clientSubBrand!=undefined) object.clientSubBrand = clientSubBrand
            if(autoIntegrate!=undefined) object.autoIntegrate = autoIntegrate
            if(agentHistory!=undefined) object.agentHistory = agentHistory
            await object.save();
        }
        return {data: 'OK'}
    },
    restoreOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            await OrganizationAzyk.updateMany({_id: {$in: _id}}, {del: null, status: 'active'})
        }
        return {data: 'OK'}
    },
    deleteOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            for(let i=0; i<_id.length; i++) {
                let items = await ItemAzyk.find({organization: _id[i]}).distinct('_id').lean()
                await BasketAzyk.deleteMany({item: {$in: items}})
                await ItemAzyk.updateMany({organization: _id[i]}, {del: 'deleted', status: 'deactive'})
                let users = await EmploymentAzyk.find({organization: _id[i]}).distinct('user').lean()
                await UserAzyk.updateMany({_id: {$in: users}}, {status: 'deactive'})
                await EmploymentAzyk.updateMany({organization: _id[i]}, {del: 'deleted'})
                await SubBrandAzyk.deleteMany({organization: _id[i]})
                await Integrate1CAzyk.deleteMany({organization: _id[i]})
                await AgentRouteAzyk.deleteMany({organization: _id[i]})
                await DistrictAzyk.deleteMany({organization: _id[i]})
                await AutoAzyk.deleteMany({organization: _id[i]})
                await RepairEquipmentAzyk.deleteMany({organization: _id[i]})
                await OrganizationAzyk.updateOne({_id: _id[i]}, {del: 'deleted', status: 'deactive'})
                await AdsAzyk.updateMany({organization: _id[i]}, {del: 'deleted'})
                await PlanAzyk.deleteMany({organization: _id[i]})
                await DeliveryDateAzyk.deleteMany({organization: _id[i]})
            }
        }
        return {data: 'OK'}
    },
    onoffOrganization: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            let objects = await OrganizationAzyk.find({_id: {$in: _id}})
            for(let i=0; i<objects.length; i++){
                objects[i].status = objects[i].status==='active'?'deactive':'active'
                await SubBrandAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                await EmploymentAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                let items = await ItemAzyk.find({organization: objects[i]._id}).distinct('_id').lean()
                await BasketAzyk.deleteMany({item: {$in: items}})
                await ItemAzyk.updateMany({organization: objects[i]._id}, {status: objects[i].status})
                await objects[i].save()
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