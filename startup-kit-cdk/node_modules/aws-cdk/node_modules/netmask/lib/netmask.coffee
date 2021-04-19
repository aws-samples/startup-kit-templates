long2ip = (long) ->
    a = (long & (0xff << 24)) >>> 24;
    b = (long & (0xff << 16)) >>> 16;
    c = (long & (0xff << 8)) >>> 8;
    d = long & 0xff;
    return [a, b, c, d].join('.')

ip2long = (ip) ->
    b = []
    for i in [0..3]
        if ip.length == 0
            break
        if i > 0
            if ip[0] != '.'
                throw new Error('Invalid IP')
            ip = ip.substring(1)
        [n, c] = atob(ip)
        ip = ip.substring(c)
        b.push(n)
    if ip.length != 0
        throw new Error('Invalid IP')
    while b.length < 4
        b.unshift(0)
    return (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0

chr = (b) ->
    return b.charCodeAt(0)

chr0 = chr('0')
chra = chr('a')
chrA = chr('A')

atob = (s) ->
    n = 0
    base = 10
    dmax = '9'
    i = 0
    if s.length > 1 and s[i] == '0'
        if s[i+1] == 'x' or s[i+1] == 'X'
            i+=2
            base = 16
        else if '0' <= s[i+1] and s[i+1] <= '7'
            i++
            base = 8
            dmax = '7'
    start = i
    while s.length > 0
        if '0' <= s[i] and s[i] <= dmax
            n = n*base + (chr(s[i])-chr0)
        else if base == 16
            if 'a' <= s[i] and s[i] <= 'f'
                n = n*base + (10+chr(s[i])-chra)
            else if 'A' <= s[i] and s[i] <= 'F'
                n = n*base + (10+chr(s[i])-chrA)
            else
                break
        else
            break
        if n > 0xFF
            throw new Error('byte overflow')
        i++
    if i == start
        throw new Error('empty octet')
    return [n, i]

class Netmask
    constructor: (net, mask) ->
        throw new Error("Missing `net' parameter") unless typeof net is 'string'
        unless mask
            # try to find the mask in the net (i.e.: 1.2.3.4/24 or 1.2.3.4/255.255.255.0)
            [net, mask] = net.split('/', 2)
        unless mask
            mask = 32
        if typeof mask is 'string' and mask.indexOf('.') > -1
            # Compute bitmask, the netmask as a number of bits in the network portion of the address for this block (eg.: 24)
            try
                @maskLong = ip2long(mask)
            catch error
                throw new Error("Invalid mask: #{mask}")
            for i in [32..0]
                if @maskLong == (0xffffffff << (32 - i)) >>> 0
                    @bitmask = i
                    break
        else if mask or mask == 0
            # The mask was passed as bitmask, compute the mask as long from it
            @bitmask = parseInt(mask, 10)
            @maskLong = 0
            if @bitmask > 0
                @maskLong = (0xffffffff << (32 - @bitmask)) >>> 0
        else
            throw new Error("Invalid mask: empty")

        try
            @netLong = (ip2long(net) & @maskLong) >>> 0
        catch error
            throw new Error("Invalid net address: #{net}")

        throw new Error("Invalid mask for ip4: #{mask}") unless @bitmask <= 32

        # The number of IP address in the block (eg.: 254)
        @size = Math.pow(2, 32 - @bitmask)
        # The address of the network block as a string (eg.: 216.240.32.0)
        @base = long2ip(@netLong)
        # The netmask as a string (eg.: 255.255.255.0)
        @mask = long2ip(@maskLong)
        # The host mask, the opposite of the netmask (eg.: 0.0.0.255)
        @hostmask = long2ip(~@maskLong)
        # The first usable address of the block
        @first = if @bitmask <= 30 then long2ip(@netLong + 1) else @base
        # The last  usable address of the block
        @last = if @bitmask <= 30 then long2ip(@netLong + @size - 2) else long2ip(@netLong + @size - 1)
        # The block's broadcast address: the last address of the block (eg.: 192.168.1.255)
        @broadcast = if @bitmask <= 30 then long2ip(@netLong + @size - 1)

    # Returns true if the given ip or netmask is contained in the block
    contains: (ip) ->
        if typeof ip is 'string' and (ip.indexOf('/') > 0 or ip.split('.').length isnt 4)
            ip = new Netmask(ip)

        if ip instanceof Netmask
            return @contains(ip.base) and @contains((ip.broadcast || ip.last))
        else
            return (ip2long(ip) & @maskLong) >>> 0 == ((@netLong & @maskLong)) >>> 0

    # Returns the Netmask object for the block which follow this one
    next: (count=1) ->
        return new Netmask(long2ip(@netLong + (@size * count)), @mask)

    forEach: (fn) ->
        # this implementation is not idiomatic but avoids large memory allocations (2 arrays, one for range and one for the results) in cases when then netmask is large
        long = ip2long(@first)
        lastLong = ip2long(@last)
        index = 0
        while long <= lastLong
          fn long2ip(long), long, index
          index++
          long++
        return

    # Returns the complete netmask formatted as `base/bitmask`
    toString: ->
        return @base + "/" + @bitmask


exports.ip2long = ip2long
exports.long2ip = long2ip
exports.Netmask = Netmask
