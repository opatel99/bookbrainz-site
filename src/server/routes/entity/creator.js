var express = require('express');
var auth = require('../../helpers/auth');
var Creator = require('../../data/entities/creator');

/* Middleware loader functions. */
var makeEntityLoader = require('../../helpers/middleware').makeEntityLoader;

var loadCreatorTypes = require('../../helpers/middleware').loadCreatorTypes;
var loadGenders = require('../../helpers/middleware').loadGenders;
var loadLanguages = require('../../helpers/middleware').loadLanguages;
var loadEntityRelationships = require('../../helpers/middleware').loadEntityRelationships;
var React = require('react');

var router = express.Router();
var EditForm = React.createFactory(require('../../../client/components/forms/creator.jsx'));

/* If the route specifies a BBID, load the Creator for it. */
router.param('bbid', makeEntityLoader(Creator, 'Creator not found'));

router.get('/:bbid', loadEntityRelationships, function(req, res, next) {
	var creator = res.locals.entity;
	var title = 'Creator';

	if (creator.default_alias && creator.default_alias.name)
		title = 'Creator “' + creator.default_alias.name + '”';

	res.render('entity/view/creator', {
		title: title
	});
});

// Creation
router.get('/create', auth.isAuthenticated, loadGenders, loadLanguages, loadCreatorTypes, function(req, res) {
	var props = {
		languages: res.locals.languages,
		genders: res.locals.genders,
		creatorTypes: res.locals.creatorTypes,
		submissionUrl: '/creator/create/handler'
	};

	var markup = React.renderToString(EditForm(props));

	res.render('entity/create/creator', {
		title: 'Add Creator',
		heading: 'Create Creator',
		subheading: 'Add a new Creator to BookBrainz',
		props: props,
		markup: markup
	});
});

router.get('/:bbid/edit', auth.isAuthenticated, loadGenders, loadLanguages, loadCreatorTypes, function(req, res) {
	var creator = res.locals.entity;

	var props = {
		languages: res.locals.languages,
		genders: res.locals.genders,
		creatorTypes: res.locals.creatorTypes,
		creator: creator,
		submissionUrl: '/creator/' + creator.bbid + '/edit/handler'
	};

	var markup = React.renderToString(EditForm(props));

	res.render('entity/create/creator', {
		title: 'Edit Creator',
		heading: 'Edit Creator',
		subheading: 'Edit an existing Creator in BookBrainz',
		props: props,
		markup: markup
	});
});

router.post('/create/handler', auth.isAuthenticated, function(req, res) {
	var changes = {
		bbid: null
	};

	if (req.body.creatorTypeId) {
		changes.creator_type = {
			creator_type_id: req.body.creatorTypeId
		};
	}

	if (req.body.genderId) {
		changes.gender = {
			gender_id: req.body.genderId
		};
	}

	if (req.body.beginDate) {
		changes.begin_date = req.body.beginDate;
	}

	if (req.body.endDate) {
		changes.end_date = req.body.endDate;
		changes.ended = true; // Must have ended if there's an end date.
	}
	else if (req.body.ended) {
		changes.ended = req.body.ended;
	}

	if (req.body.disambiguation)
		changes.disambiguation = req.body.disambiguation;

	if (req.body.annotation)
		changes.annotation = req.body.annotation;

	if (req.body.note) {
		changes.revision = {
			note: req.body.note
		};
	}

	if (req.body.aliases.length) {
		var default_alias = req.body.aliases[0];

		changes.aliases = [{
			name: default_alias.name,
			sort_name: default_alias.sortName,
			language_id: default_alias.languageId,
			primary: default_alias.primary,
			default: true
		}];
	}

	Creator.create(changes, {
			session: req.session
		})
		.then(function(revision) {
			res.send(revision);
		});
});

router.post('/:bbid/edit/handler', auth.isAuthenticated, function(req, res) {
	var creator = res.locals.entity;

	var changes = {
		bbid: creator.bbid
	};

	var creatorTypeId = req.body.creatorTypeId;
	if ((!creator.creator_type) ||
	    (creator.creator_type.creator_type_id !== creatorTypeId)) {
		changes.creator_type = {
			creator_type_id: creatorTypeId
		};
	}

	var genderId = req.body.genderId;
	if ((!creator.gender) || (creator.gender.gender_id !== genderId)) {
		changes.gender = genderId;
	}

	var beginDate = req.body.beginDate;
	if (creator.begin_date !== beginDate) {
		changes.begin_date = beginDate ? beginDate : null;
	}

	var endDate = req.body.endDate;
	var ended = req.body.ended;
	if (creator.end_date !== endDate) {
		changes.end_date = endDate ? endDate : null;
		changes.ended = endDate ? true : ended; // Must have ended if there's an end date.
	}

	var disambiguation = req.body.disambiguation;
	if ((!creator.disambiguation) ||
	    (creator.disambiguation.comment !== disambiguation)) {
		changes.disambiguation = disambiguation ? disambiguation : null;
	}

	var annotation = req.body.annotation;
	if ((!creator.annotation) ||
			(creator.annotation.content !== annotation)) {
		changes.annotation = annotation ? annotation : null;
	}

	if (req.body.note) {
		changes.revision = {
			note: req.body.note
		};
	}

	var currentAliases = creator.aliases.map(function(alias) {
		var nextAlias = req.body.aliases[0];

		if (alias.id != nextAlias.id) {
			// Remove the alias
			return [alias.id, null];
		}
		else {
			// Modify the alias
			req.body.aliases.shift();
			return [
				nextAlias.id,
				{
					name: nextAlias.name,
					sort_name: nextAlias.sort_name,
					language_id: nextAlias.languageId,
					primary: alias.primary,
					default: alias.default
				}
			];
		}
	});

	var newAliases = req.body.aliases.map(function(alias) {
		// At this point, the only aliases should have null IDs, but check anyway.
		if (alias.id) {
			return null;
		}
		else {
			return [
				null,
				{
					name: alias.name,
					sort_name: alias.sort_name,
					language_id: alias.languageId,
					primary: false,
					default: false
				}
			];
		}
	});

	changes.aliases = currentAliases.concat(newAliases);
	if (changes.aliases.length !== 0 && changes.aliases[0][1]) {
		changes.aliases[0][1].default = true;
	}

	Creator.update(creator.bbid, changes, {
		session: req.session
	})
		.then(function(revision) {
			res.send(revision);
		});
});

module.exports = router;
