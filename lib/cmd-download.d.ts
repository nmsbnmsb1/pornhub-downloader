import IContext from './context';
interface IPornhubContext extends IContext {
    pornhubID: string;
    pornhubWatch: boolean;
}
declare const _default: (context: IPornhubContext) => Promise<void>;
export default _default;
