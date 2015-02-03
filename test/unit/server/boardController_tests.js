/* global describe, it, before, beforeEach, after, afterEach, xdescribe, xit */
/* jslint node: true */
"use strict";

var chai = require('chai'),
    spies = require('chai-spies');
chai.use(spies);

var expect = chai.expect;
var assert = chai.assert;

var constants = require('../../../shared/constants/boardConstants');
var helpers = require('../../../shared/helpers.js');

var boardModel = require('../../../server/models/board');
var boardController = require('../../../server/controllers/boardController');
var oldIo;

//Test Global Variables
var boardId;
var boardName = 'Board';
var scrumMaster = 'scrumMaster';
var scrumMasterKey = 'scrumMasterKey';
var userA = 'userA';
var userB = 'userB';

describe('boardController', function () {

    before(function () {
        function Mock() {
        }

        Mock.prototype.to = function () {
            return this;
        };
        Mock.prototype.emit = function () {
        };

        var request = {
            params: {
                mock: new Mock()
            }
        };

        var reply = function (responseValue) {
            oldIo = responseValue;
        };

        boardController.setIo.handler(request, reply);
    });

    describe('#getBoard', function () {
        var oldGet = boardModel.get;
        var spyGet = chai.spy(function (id, cb) {
            cb(spyErr, spyValue);
        });

        var spyErr, spyValue;

        // Setup: isolate method being tested from its dependencies
        before(function () {
            boardModel.get = spyGet;
        });

        // Teardown: return dependencies to their original state
        after(function () {
            boardModel.get = oldGet;
        });

        beforeEach(function () {
            spyErr = spyValue = undefined;
        });

        it('should call board.get exactly once', function (done) {
            var request = {
                params: {
                    id: 0
                }
            };

            var reply = function () {
                expect(spyGet).to.have.been.called.exactly(1);
                done();
            };

            boardController.getBoard.handler(request, reply);
        });

        it('should reply with a 404 error if one is returned from board.get', function (done) {
            spyErr = 'generic error';

            var request = {
                params: {
                    id: 0
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.be.an.instanceof(Error);
                expect(responseValue).to.have.deep.property('output.statusCode', 404);
                done();
            };

            boardController.getBoard.handler(request, reply);
        });

        it('should reply with the value returned from board.get if there is no error', function (done) {
            spyValue = 'this is my response';

            var request = {
                params: {
                    id: 0
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.equal(spyValue);
                done();
            };

            boardController.getBoard.handler(request, reply);
        });
    });

    describe('#Board initialization', function () {
        it('should create 1 board', function (done) {
            var request = {
                payload: {
                    user: scrumMaster,
                    boardName: boardName,
                    scrumMasterKey: scrumMasterKey
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.have.deep.property('title', boardName);
                expect(responseValue).to.have.deep.property('scrumMaster', scrumMaster);
                expect(responseValue).to.have.deep.property('scrumMasterKey', scrumMasterKey);
                boardId = responseValue.id;
                done();
            };

            boardController.createBoard.handler(request, reply);
        });

        it('should retrieve previously created board by Id', function (done) {
            var request = {
                params: {
                    id: boardId
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.have.deep.property('title', boardName);
                expect(responseValue).to.have.deep.property('scrumMaster', scrumMaster);
                expect(responseValue).to.have.deep.property('scrumMasterKey', scrumMasterKey);
                done();
            };

            boardController.getBoard.handler(request, reply);
        });

        it('should verify the scrum master key was set correctly', function (done) {
            boardModel.isScrumMasterKeyCorrect(boardId, scrumMasterKey, function (err, result) {
                assert.isNull(err, 'there was no error');
                assert.isTrue(result, 'Scrum Master Key was set correctly!');
                done();
            });
        });

        it('should delete the created board', function (done) {
            var request = {
                params: {
                    id: boardId,
                    scrumMasterKey: scrumMasterKey
                }
            };

            var reply = function (responseValue) {
                assert.isTrue(responseValue, 'Board has been deleted successfully');
                done();
            };

            boardController.deleteBoard.handler(request, reply);
        });

        it('should not find the created board', function (done) {
            var request = {
                params: {
                    id: boardId
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.be.an.instanceof(Error);
                expect(responseValue).to.have.deep.property('output.statusCode', 404);
                done();
            };

            boardController.getBoard.handler(request, reply);
        });
    });

    describe('#Board Participants', function () {
        before(function (done) {
            boardModel.create(scrumMaster, boardName, scrumMasterKey, function (err, data) {
                assert.isUndefined(err, 'there was no error');
                boardId = data.id;

                boardModel.joinBoard(boardId, userA, function (err) {
                    assert.isUndefined(err, 'there was no error');
                    boardModel.joinBoard(boardId, userB, function (err) {
                        assert.isUndefined(err, 'there was no error');
                        done();
                    });
                });
            });
        });

        it('should find 2 particpants', function (done) {
            var request = {
                params: {
                    id: boardId
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.include.members([userA, userB]);
                done();
            };

            boardController.getBoardParticipants.handler(request, reply);
        });

        it('should find 1 participant after 1 leaves', function (done) {
            boardModel.leaveBoard(boardId, userA, function (err) {
                assert.isUndefined(err, 'there was no error');
                var request = {
                    params: {
                        id: boardId
                    }
                };

                var reply = function (responseValue) {
                    expect(responseValue).to.include.members([userB]);
                    done();
                };

                boardController.getBoardParticipants.handler(request, reply);
            });
        });
    });

    describe('#Board Feedback', function () {
        before(function (done) {
            boardModel.create(scrumMaster, boardName, scrumMasterKey, function (err, data) {
                assert.isUndefined(err, 'there was no error');
                boardId = data.id;

                boardModel.joinBoard(boardId, userA, function (err) {
                    assert.isUndefined(err, 'there was no error');
                    boardModel.joinBoard(boardId, userB, function (err) {
                        assert.isUndefined(err, 'there was no error');
                        done();
                    });
                });
            });
        });

        var wentWellFeedback;
        it('should add feedback to \'What Went Well\' list', function (done) {
            var request = {
                params: {
                    id: boardId,
                    type: constants.feedbackTypes.whatWentWell
                },
                payload: {
                    feedback: 'testFeedback'
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.have.deep.property('feedback', 'testFeedback');
                wentWellFeedback = responseValue;
                done();
            };

            boardController.addFeedback.handler(request, reply);
        });

        it('should edit feedback in \'What Went Well\' list', function (done) {
            wentWellFeedback.feedback = 'edited feedback';
            var request = {
                params: {
                    id: boardId,
                    type: constants.feedbackTypes.whatWentWell
                },
                payload: {
                    editedFeedback: wentWellFeedback
                }
            };

            var reply = function (responseValue) {
                expect(responseValue).to.have.deep.property('feedback', 'edited feedback');
                done();
            };

            boardController.editFeedback.handler(request, reply);
        });

        it('should delete feedback in \'What Went Well\' list', function (done) {
            var request = {
                params: {
                    id: boardId,
                    type: constants.feedbackTypes.whatWentWell,
                    feedbackId: wentWellFeedback.id
                }
            };

            var deleteReply = function (responseValue) {
                assert.isTrue(responseValue);
                boardController.getBoard.handler(request, getReply);
            };

            var getReply = function (responseValue) {
                expect(responseValue.wellFeedback).to.have.length(0);
                done();
            };

            boardController.deleteFeedback.handler(request, deleteReply);
        });

        it('should set \'What Needs Improvement\' Feedback list', function (done) {
            var feedbacks = [{id: helpers.guid() , feedback: 'Improve TestFeedback 1'},
                {id: helpers.guid(), feedback: 'Improve TestFeedback 2'}];
            var request = {
                params: {
                    id: boardId,
                    type: constants.feedbackTypes.whatNeedsImprovement
                },
                payload: {
                    feedback: feedbacks,
                    scrumMasterKey: scrumMasterKey
                }
            };

            var reply = function (responseValue) {
                expect(responseValue.improveFeedback).to.deep.equal(feedbacks);
                done();
            };

            boardController.setFeedback.handler(request, reply);
        });
    });

    describe('#Board Themes', function () {
        var theme = 'testTheme';

        before(function (done) {
            boardModel.create(scrumMaster, boardName, scrumMasterKey, function (err, data) {
                assert.isUndefined(err, 'there was no error');
                boardId = data.id;

                boardModel.joinBoard(boardId, userA, function (err) {
                    assert.isUndefined(err, 'there was no error');
                    boardModel.joinBoard(boardId, userB, function (err) {
                        assert.isUndefined(err, 'there was no error');
                        var feedback1 = {
                            params: {
                                id: boardId,
                                type: constants.feedbackTypes.whatNeedsImprovement
                            },
                            payload: {
                                feedback: 'testFeedback'
                            }
                        };

                        var feedback2 = {
                            params: {
                                id: boardId,
                                type: constants.feedbackTypes.whatNeedsImprovement
                            },
                            payload: {
                                feedback: 'testFeedback'
                            }
                        };

                        var fDreply1 = function () {
                            boardController.addFeedback.handler(feedback2, fDreply2);
                        };

                        var fDreply2 = function () {
                            done();
                        };

                        boardController.addFeedback.handler(feedback1, fDreply1);
                    });
                });
            });
        });

        it('should create the Theme \'testTheme\'', function (done) {
            var request = {
                params: {
                    id: boardId
                },
                payload: {
                    theme: 'testTheme'
                }
            };

            var reply = function (responseValue) {
                assert.equal(responseValue, 'testTheme');
                done();
            };

            boardController.addTheme.handler(request, reply);
        });

        it('should verify that the \'testTheme\' Theme was added and changed to \'alternate theme\' Theme', function (done) {
            var request = {
                params: {
                    id: boardId
                }
            };

            var reply = function (responseValue) {
                var themes = responseValue;
                expect(responseValue[0]).to.have.deep.property('description', theme);

                themes[0].description = 'alternate theme';
                var request = {
                    params: {
                        id: boardId
                    },
                    payload: {
                        theme: 'alternate theme',
                        themes: themes
                    }
                };
                var reply = function () {
                    boardModel.getThemes(boardId, function (err, data) {
                        assert.isNull(err, 'there was no error');
                        expect(data[0]).to.have.deep.property('description', 'alternate theme');
                        done();
                    });

                };

                boardController.changeThemes.handler(request, reply);
            };

            boardController.getThemes.handler(request, reply);
        });

        it('should create a theme from feedback in \'What Needs Improvement\' Feedback', function (done) {
            boardModel.createThemesFromImproveFeedback(boardId, function (err) {
                assert.isUndefined(err, 'there was no error');

                boardModel.getThemes(boardId, function (err, data) {
                    assert.isNull(err, 'there was no error');
                    expect(data).to.have.length(2);
                    done();
                });
            });
        });

        it('should create action items from created Themes', function (done) {
            boardModel.createActionItemsFromThemes(boardId, function (err) {
                assert.isUndefined(err, 'there was no error');

                boardModel.get(boardId, function (err, data) {
                    assert.isNull(err, 'there was no error');
                    expect(data.actionItems).to.have.length(2);
                    done();
                });
            });
        });
    });

    describe('#Board Voting', function () {
        var theme = 'testTheme';

        before(function (done) {
            boardModel.create(scrumMaster, boardName, scrumMasterKey, function (err, data) {
                assert.isUndefined(err, 'there was no error');
                boardId = data.id;

                boardModel.joinBoard(boardId, userA, function (err) {
                    assert.isUndefined(err, 'there was no error');
                    boardModel.joinBoard(boardId, userB, function (err) {
                        assert.isUndefined(err, 'there was no error');
                        var feedback1 = {
                            params: {
                                id: boardId,
                                type: constants.feedbackTypes.whatNeedsImprovement
                            },
                            payload: {
                                feedback: 'testFeedback'
                            }
                        };

                        var feedback2 = {
                            params: {
                                id: boardId,
                                type: constants.feedbackTypes.whatNeedsImprovement
                            },
                            payload: {
                                feedback: 'testFeedback'
                            }
                        };

                        var fDreply1 = function () {
                            boardController.addFeedback.handler(feedback2, fDreply2);
                        };

                        var fDreply2 = function () {
                            done();
                        };

                        boardController.addFeedback.handler(feedback1, fDreply1);
                    });
                });
            });
        });

        it('should set the board phase to \'Voting Started\'', function (done) {
            var request = {
                params: {
                    id: boardId
                },
                payload: {
                    scrumMasterKey: scrumMasterKey,
                    phase: constants.phases.actionVotingStarted
                }
            };

            var reply = function (responseValue) {
                assert.isTrue(responseValue);
                done();
            };

            boardController.setBoardPhase.handler(request, reply);
        });

        it('should tally the votes for each theme', function (done) {
            boardModel.getThemes(boardId, function (err, data) {
                assert.isNull(err, 'there was no error');
                var themeId1 = data[0].id;
                var themeId2 = data[1].id;
                var themeIdCollection = {};
                themeIdCollection[themeId1] = 4;
                themeIdCollection[themeId2] = 2;

                var request = {
                    params: {
                        id: boardId
                    },
                    payload: {
                        themeIdVoteCollection: themeIdCollection
                    }
                };

                var reply = function (responseValue) {
                    assert.isTrue(responseValue);
                    done();
                };

                boardController.addVotes.handler(request, reply);
            });


        });

        it('should set the board phase to \'Voting Ended\'', function (done) {
            this.timeout(3500);
            var request = {
                params: {
                    id: boardId
                },
                payload: {
                    scrumMasterKey: scrumMasterKey,
                    phase: constants.phases.actionVotingEnded
                }
            };

            var reply = function (responseValue) {
                assert.isTrue(responseValue);
                done();
            };

            boardController.setBoardPhase.handler(request, reply);
        });
    });

    after(function () {
        var request = {
            params: {
                mock: oldIo
            }
        };

        var reply = function () {
        };

        boardController.setIo.handler(request, reply);
    });
});
