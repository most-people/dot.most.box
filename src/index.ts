import { DotServer } from './DotServer'
import { DotClient } from './DotClient'
import { mostWallet, encode, decode } from './MostWallet'

export type { MostWallet } from './MostWallet'

const Dot = {
    DotServer,
    DotClient,
    mostWallet,
    encode,
    decode,
}

export default Dot
