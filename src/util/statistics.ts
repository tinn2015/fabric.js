(function() {
	class Statistics {
		// 最近十次自由绘平均耗时
		_recentlyPathTimeCollect: number[] = []
		_recentlyPathTime = 0

		// 当前自由绘耗时
		_pathStartTimestamp = 0
		_lastPathTime = 0

		// 是否统计耗时
		enableStatistics = false

		toggleStatistics (flag: boolean) {
			if (flag === false) {
				this._recentlyPathTimeCollect = []
				this._recentlyPathTime = 0
				this._lastPathTime = 0
			}
			this.enableStatistics = flag
		}

		// 记录提笔开始时间
		recordPathStartTime (time: number) {
			this._pathStartTimestamp = time
		}

		// 计算path 绘制消耗时间
		calcPathTime (time: number) {
			this._lastPathTime = time - this._pathStartTimestamp
			if (this._recentlyPathTimeCollect.length < 10) {
				this._recentlyPathTimeCollect.push(this._lastPathTime)
			} else {
				this._recentlyPathTimeCollect.shift()
				this._recentlyPathTimeCollect.push(this._lastPathTime)
			}
			const totalTime = this._recentlyPathTimeCollect.reduce((cur, pre) => {
				return cur + pre
			}, 0)
			this._recentlyPathTime = totalTime /  this._recentlyPathTimeCollect.length
		}

		getStat () {
			return {
				currentPathTime: this._lastPathTime,
				recentlyPathTime: this._recentlyPathTime
			}
		}
	}

  window.fabric.util.statistics = new Statistics()
})();
  