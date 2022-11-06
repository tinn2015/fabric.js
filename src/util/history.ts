import { fabric } from "../../HEADER";

(function() {
    interface snapshot {
        type: string,
        props?: Record<string, any>
        action?: string
        objects?: any[],
        current?: Record<string, any>,
        original?: Record<string, any>
        // canvasJson?: Record<string, any> // 整个画布json
    }

    class History {
        stack: snapshot[]
        currentIndex: number
        fCanvas: Record<string, any>
        uiRender: (() => void) | undefined
        constructor (fCanvas: Record<string, any>) {
            this.stack = []
            this.currentIndex = 0
            this.fCanvas = fCanvas
            window.fabric.util.history= this
        }
        get lastIndex () {
            return this.stack.length -1 
        }

        get canUndo () {
            return this.currentIndex > -1
        }
        get canRedo () {
            return this.currentIndex < this.lastIndex
        }

        setUiRender (fn: () => void) {
            this.uiRender = fn
        }

        getCurrentStack () {
            return this.stack[this.currentIndex]
        }

        /**
         * 
         * @param sync true: 主动undo/redo， false: 被动undo/redo， 被动时不需要再次协同
         * @param callback 
         * @returns 
         */
        undo (sync=true, callback: () => void) {
            if (!this.stack.length || this.currentIndex <= -1) return
            const snapshot = this.stack[this.currentIndex]

            // 添加/删除 反向操作 add -> remove, remove-> add
            if (snapshot.type === 'add') {
                snapshot.type = 'remove'
            } else if (snapshot.type === 'remove') {
                snapshot.type = 'add'
            }

            // 修改 反向操作 current -> original
            snapshot.type === 'modified' ? snapshot.objects?.forEach(obj => {
                const temp = obj.current
                obj.current = obj.original
                obj.original = temp  
            }) : null

            // 清除, 设置背景色，设置背景图 反向操作 current -> original
            if (snapshot.type === 'clear'  || snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
                const temp = snapshot.current
                snapshot.current = snapshot.original
                snapshot.original = temp
                snapshot.current?.objects.forEach((obj: any) => {
                    obj.qn.sync = true
                })
            }

            this._handle(snapshot, sync)
            if (this.currentIndex > -1) {
                this.currentIndex--
            }
            this.uiRender && this.uiRender()

            // sync && window.fabric.util.socket && window.fabric.util.socket.sendCmd({ cmd: "undo" })
            callback && callback()
        }
        
        redo (sync=true, callback: () => void) {
            if (!this.stack.length || this.currentIndex == this.lastIndex) return
            if (this.currentIndex < this.lastIndex) {
                this.currentIndex++
            }
            const snapshot = this.stack[this.currentIndex]

            // 添加/删除 反向操作 add -> remove, remove-> add
            if (snapshot.type === 'add') {
                snapshot.type = 'remove'
            } else if (snapshot.type === 'remove') {
                snapshot.type = 'add'
            }

            // 反向操作 original -> current
            snapshot.type === 'modified' ? snapshot.objects?.forEach(obj => {
                const temp = obj.current
                obj.current = obj.original
                obj.original = temp
                snapshot.current?.objects.forEach((obj: any) => {
                    obj.qn.sync = true
                })
            }) : null

            // 清除, 设置背景色，设置背景图 反向操作 current -> original
            if (snapshot.type === 'clear' || snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
                const temp = snapshot.current
                snapshot.current = snapshot.original
                snapshot.original = temp
            }

            this._handle(snapshot, sync)

            this.uiRender && this.uiRender()

            // sync && window.fabric.util.socket && window.fabric.util.socket.sendCmd({ cmd: "redo" })
            callback && callback()
        }

        /**
         * 需要入栈的行为
         *  1. 新建对象 add
         *  2. 修改对象（单个、group） modified
         *  3. 删除对象 remove
         *  4. clear clear
         *  5. 设置背景 setBgColor/setBgImg
         *  6. 橡皮擦
         */
        push (data: snapshot) {
            const { objects } = data
            objects?.forEach(obj => {
                const {qn} = obj
                qn.sync = true
            })
            this.stack.push(data)

            this.currentIndex = this.lastIndex
            this.uiRender && this.uiRender()
        }

        _handle (data: snapshot, sync: boolean) {
            // 清空selection
            this.fCanvas.discardActiveObject().renderAll();
            const {type}  = data
            switch (type) {
                case 'add':
                    this.__objectAdd(data, sync)
                break
                case 'remove':
                    this.__objectRemove(data, sync)
                    break
                case 'modified':
                    this.__objectModified(data, sync)
                    break
                case 'clear':
                    this.__clearCanvas(data)
                    break
                case 'bgColor':
                    this.__setBackgroundColor(data)
                    break
                case 'bgImage':
                    this.__setBackgroundImage(data)

            }
            console.log('this.stack', this.stack)
        }

        // 删除对象
        __objectRemove(data: snapshot, sync: boolean) {
            const {objects} = data
            objects?.forEach(object => {
                object.qn.sync = sync
                object.qn.noHistoryStack = true
                this.fCanvas.remove(object);
            })
        }

        // 添加对象
        __objectAdd(data: snapshot, sync: boolean) {
            const {objects} = data
            objects?.forEach(object => {
                object.qn.sync = sync
                object.qn.noHistoryStack = true
                this.fCanvas.add(object);
            })
            this.fCanvas.requestRenderAll()
        }

        // 修改对象
        __objectModified(data: snapshot, sync: boolean) {
            const  {objects, action} = data
            console.log('__objectModified', data)
            objects?.forEach(obj => {
                const index = this.fCanvas.getObjects().findIndex((i: any) => i.qn.oid === obj.qn.oid)
                if (index > -1) {
                    this.fCanvas.item(index).setOptions(obj.current)

                    // undo/redo 的修改协同
                    fabric.util.socket && fabric.util.socket.draw(Object.assign({}, obj.current, {qn: obj.qn, at: action}))
                }
            })
            this.fCanvas.requestRenderAll()
        }

        // 画布清除
        async __clearCanvas(data: snapshot) {
            const {current} = data
            // if (current?.objects.length) {
            //     current.objects.forEach((i: any) => {
            //         // 收消息标识， 避免load的时候发送socket
            //         i.qn.isReceived = true
            //     })
            // }
            await this.fCanvas.loadFromJSON(current)
            this.fCanvas.requestRenderAll()
        }

        // 设置背景色
        __setBackgroundColor(data: snapshot) {
            const {current} = data
            this.fCanvas.setBgColorOrBgImgForUndoRedo(current, false)
            console.log('__setBackgroundColor', data)
            this.fCanvas.requestRenderAll()
            fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "bgColor", color: current })
        }

        // 设置背景图片
        __setBackgroundImage(data: snapshot) {
            const {current} = data
            this.fCanvas.setBgColorOrBgImgForUndoRedo(current, false)
            console.log('__setBackgroundImage', data)
            this.fCanvas.requestRenderAll()
            fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "bgImg", url: current?._element.currentSrc })
        }

    }


    window.fabric.util.History = History
  })();
  