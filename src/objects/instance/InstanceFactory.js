import CardInstance from './card/CardInstance'
import FireInstance from './fire/FireInstance'
import SledInstance from './sled/SledInstance'


export default class InstanceFactory {

    static types = {
        'card': CardInstance,
        'fire': FireInstance,
        'sled': SledInstance
    }

    static createInstance(waddle) {
        return new this.types[waddle.game](waddle)
    }

}
