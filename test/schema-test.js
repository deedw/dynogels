'use strict';

const Schema = require('../lib/schema');
const chai = require('chai');
const Joi = require('joi');
const _ = require('lodash');
const sinon = require('sinon');

const expect = chai.expect;

chai.should();

describe('schema', () => {
  describe('setup', () => {
    it('should set hash key', () => {
      const config = {
        hashKey: 'id'
      };

      const s = new Schema(config);
      s.hashKey.should.equal('id');
    });

    it('should set hash and range key', () => {
      const config = {
        hashKey: 'id',
        rangeKey: 'date'
      };

      const s = new Schema(config);
      s.hashKey.should.equal('id');
      s.rangeKey.should.equal('date');
    });

    it('should set table name to string', () => {
      const config = {
        hashKey: 'id',
        tableName: 'test-table'
      };

      const s = new Schema(config);
      s.tableName.should.equal('test-table');
    });

    it('should set table name to function', () => {
      const func = () => 'test-table';

      const config = {
        hashKey: 'id',
        tableName: func
      };

      const s = new Schema(config);
      s.tableName.should.equal(func);
    });

    it('should add timestamps to schema', () => {
      const config = {
        hashKey: 'id',
        timestamps: true,
        schema: {
          id: Joi.string()
        }
      };

      const s = new Schema(config);
      s.timestamps.should.be.true;

      expect(s._modelSchema.describe().keys).to.have.keys(['id', 'createdAt', 'updatedAt']);

      s._modelDatatypes.should.eql({
        id: 'S',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      });
    });

    it('should add timestamps with custom names to schema', () => {
      const config = {
        hashKey: 'id',
        timestamps: true,
        createdAt: 'created',
        updatedAt: 'updated',
        schema: {
          id: Joi.string()
        }
      };

      const s = new Schema(config);
      s.timestamps.should.be.true;

      expect(s._modelSchema.describe().keys).to.have.keys(['id', 'created', 'updated']);

      s._modelDatatypes.should.eql({
        id: 'S',
        created: 'DATE',
        updated: 'DATE',
      });
    });

    it('should only add createdAt timestamp ', () => {
      const config = {
        hashKey: 'id',
        timestamps: true,
        updatedAt: false,
        schema: {
          id: Joi.string()
        }
      };

      const s = new Schema(config);
      s.timestamps.should.be.true;

      expect(s._modelSchema.describe().keys).to.have.keys(['id', 'createdAt']);

      s._modelDatatypes.should.eql({
        id: 'S',
        createdAt: 'DATE'
      });
    });

    it('should only add updatedAt timestamp ', () => {
      const config = {
        hashKey: 'id',
        timestamps: true,
        createdAt: false,
        schema: {
          id: Joi.string()
        }
      };

      const s = new Schema(config);
      s.timestamps.should.be.true;

      expect(s._modelSchema.describe().keys).to.have.keys(['id', 'updatedAt']);

      s._modelDatatypes.should.eql({
        id: 'S',
        updatedAt: 'DATE'
      });
    });

    it('should only add custom created timestamp ', () => {
      const config = {
        hashKey: 'id',
        timestamps: true,
        createdAt: 'fooCreate',
        updatedAt: false,
        schema: {
          id: Joi.string()
        }
      };

      const s = new Schema(config);
      s.timestamps.should.be.true;

      expect(s._modelSchema.describe().keys).to.have.keys(['id', 'fooCreate']);

      s._modelDatatypes.should.eql({
        id: 'S',
        fooCreate: 'DATE'
      });
    });

    it('should throw error when hash key is not present', () => {
      const config = { rangeKey: 'foo' };

      expect(() => {
        new Schema(config);
      }).to.throw(); // /hashKey is required/
    });

    it('should setup local secondary index when both hash and range keys are given', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { hashKey: 'foo', rangeKey: 'bar', type: 'local', name: 'LocalBarIndex' }
        ]
      };

      const s = new Schema(config);
      s.secondaryIndexes.should.include.keys('LocalBarIndex');
      s.globalIndexes.should.be.empty;
    });

    it('should setup local secondary index when only range key is given', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { rangeKey: 'bar', type: 'local', name: 'LocalBarIndex' }
        ]
      };

      const s = new Schema(config);
      s.secondaryIndexes.should.include.keys('LocalBarIndex');
      s.globalIndexes.should.be.empty;
    });

    it('should throw when local index rangeKey isnt present', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { hashKey: 'foo', type: 'local', name: 'LocalBarIndex' }
        ]
      };

      expect(() => {
        new Schema(config);
      }).to.throw(/rangeKey.*missing/);
    });

    it('should throw when local index hashKey does not match the tables hashKey', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { hashKey: 'bar', rangeKey: 'date', type: 'local', name: 'LocalDateIndex' }
        ]
      };

      expect(() => {
        new Schema(config);
      }).to.throw(); // /hashKey must be one of context:hashKey/
    });

    it('should setup global index', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { hashKey: 'bar', type: 'global', name: 'GlobalBarIndex' }
        ]
      };

      const s = new Schema(config);
      s.globalIndexes.should.include.keys('GlobalBarIndex');
      s.secondaryIndexes.should.be.empty;
    });

    it('should throw when global index hashKey is not present', () => {
      const config = {
        hashKey: 'foo',
        indexes: [
          { rangeKey: 'date', type: 'global', name: 'GlobalDateIndex' }
        ]
      };

      expect(() => {
        new Schema(config);
      }).to.throw(); // /hashKey is required/
    });

    it('should parse schema data types', () => {
      const config = {
        hashKey: 'foo',
        schema: Joi.object().keys({
          foo: Joi.string().default('foobar'),
          date: Joi.date().default(Date.now),
          count: Joi.number(),
          flag: Joi.boolean(),
          nums: Joi.array().items(Joi.number()).meta({ dynamoType: 'NS' }),
          items: Joi.array(),
          data: Joi.object().keys({
            stuff: Joi.array().meta({ dynamoType: 'SS' }),
            nested: {
              first: Joi.string(),
              last: Joi.string(),
              nicks: Joi.array().meta({ dynamoType: 'SS', foo: 'bar' }),
              ages: Joi.array().meta({ foo: 'bar' }).meta({ dynamoType: 'NS' }),
              pics: Joi.array().meta({ dynamoType: 'BS' }),
              bin: Joi.binary()
            }
          })
        })
      };

      const s = new Schema(config);

      s._modelSchema.should.eql(config.schema);
      s._modelDatatypes.should.eql({
        foo: 'S',
        date: 'DATE',
        count: 'N',
        flag: 'BOOL',
        nums: 'NS',
        items: 'L',
        data: {
          nested: {
            ages: 'NS',
            first: 'S',
            last: 'S',
            nicks: 'SS',
            pics: 'BS',
            bin: 'B'
          },
          stuff: 'SS'
        }
      });
    });
  });

  describe('#stringSet', () => {
    it('should set as string set', () => {
      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string().email(),
          names: Schema.types.stringSet()
        }
      };

      const s = new Schema(config);

      s._modelDatatypes.should.eql({
        email: 'S',
        names: 'SS',
      });
    });
  });

  describe('#numberSet', () => {
    it('should set as number set', () => {
      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string().email(),
          nums: Schema.types.numberSet()
        }
      };

      const s = new Schema(config);

      s._modelDatatypes.should.eql({
        email: 'S',
        nums: 'NS',
      });
    });
  });

  describe('#binarySet', () => {
    it('should set as binary set', () => {
      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string().email(),
          pics: Schema.types.binarySet()
        }
      };

      const s = new Schema(config);

      s._modelDatatypes.should.eql({
        email: 'S',
        pics: 'BS',
      });
    });
  });


  describe('#uuid', () => {
    it('should set as uuid with default uuid function', () => {
      const config = {
        hashKey: 'id',
        schema: {
          id: Schema.types.uuid(),
        }
      };

      const s = new Schema(config);
      expect(s.applyDefaults({}).id).should.not.be.empty;
    });
  });

  describe('#timeUUID', () => {
    it('should set as TimeUUID with default v1 uuid function', () => {
      const config = {
        hashKey: 'id',
        schema: {
          id: Schema.types.timeUUID(),
        }
      };

      const s = new Schema(config);
      expect(s.applyDefaults({}).id).should.not.be.empty;
    });
  });

  describe('#validate', () => {
    it('should return no err for string', () => {
      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string().email().required()
        }
      };

      const s = new Schema(config);

      expect(s.validate({ email: 'foo@bar.com' }).error).to.be.undefined;
    });

    it('should return no error for valid date object', () => {
      const config = {
        hashKey: 'created',
        schema: {
          created: Joi.date()
        }
      };

      const s = new Schema(config);

      expect(s.validate({ created: new Date() }).error).to.be.undefined;
      expect(s.validate({ created: Date.now() }).error).to.be.undefined;
    });

    it('should pass through validation options', () => {
      const config = {
        hashKey: 'name',
        schema: {
          name: Joi.string()
        },
        validation: {
          allowUnknown: true
        }
      };

      const s = new Schema(config);
      expect(s.validate({ name: 'foo', age: 1 }).error).to.be.undefined;
    });
  });

  describe('#applyDefaults', () => {
    it('should apply default values', () => {
      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string(),
          name: Joi.string().default('Foo Bar'),
          age: Joi.number().default(3)
        }
      };

      const s = new Schema(config);

      const d = s.applyDefaults({ email: 'foo@bar.com' });

      d.email.should.equal('foo@bar.com');
      d.name.should.equal('Foo Bar');
      d.age.should.equal(3);
    });

    it('should return result of default functions', () => {
      const clock = sinon.useFakeTimers(Date.now());

      const config = {
        hashKey: 'email',
        schema: {
          email: Joi.string(),
          created: Joi.date().default(Date.now),
          data: {
            name: Joi.string().default('Tim Tester'),
            nick: Joi.string().default(_.constant('foo bar')).description('lodash constant \'foo bar\'')
          }
        }
      };

      const s = new Schema(config);

      const d = s.applyDefaults({ email: 'foo@bar.com', data: {} });

      d.should.eql({
        email: 'foo@bar.com',
        created: Date.now(),
        data: {
          name: 'Tim Tester',
          nick: 'foo bar'
        }
      });

      clock.restore();
    });
  });
});
