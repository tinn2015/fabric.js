(function() {
    function guid() {
        function S4() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }
        return (S4() + S4());
    }

    /**
		 * 
		 * @returns {
		 * 		cid: string, // createrId 创建人id
		 *		mid: string, // modifiedId 修改人id
		 *		ts: number, // timeStamp 修改时得时间戳
		 *		oid: string, // objectId 每个对象得唯一标识
		 *      w: number, // 当前画布的width
		 *		t?: string,  // type 当前类型
		 *		sync: boolean // 是否需要同步标识
		 * }
		 */
    function genQn (option: any) {
        const defaultQn =  {
			cid: window.fabric.util.userId || guid(),
			mid: window.fabric.util.userId || guid(),
			oid: guid(),
			sync: true
		}
        return  Object.assign({}, defaultQn, option)
    }

		/**
		 * 
		 * @param {*} type 属性名
		 * @param {*} v 挂载的内容
		 */
		function use (type: string, v: unknown) {
			window.fabric.util[type] = v
		}

    window.fabric.util.genQn = genQn;
	window.fabric.util.use = use
  })();
  